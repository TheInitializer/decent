// TODO: Resources. When a resource is sent back to the client, it is sent in a
// serialized form - for example, a User resource might serialize to not include
// the password hash or salt fields. (NOTE: Resources DO NOT have to be JavaScript
// objects! It could be as simple as defining "serialize" functions for each type
// of resource, e.g. serializeUser.)

// TODO: Parameters. When defining an API endpoint, parameters can be specified.
// These may be automatically processed - for example, a sessionID parameter could
// automatically be turned into a user object fetched from the database, and, if
// that user object is not found, it could automatically prevent the API request
// from continuing.

const express = require('express')
const bodyParser = require('body-parser')
const uuidv4 = require('uuid/v4')
const bcrypt = require('./bcrypt-util')

module.exports = function attachAPI(app, {io, db}) {
  // Used to only send message events to clients who are in the same channel as the
  // message.
  const socketChannelMap = new Map()

  const getUserBySessionID = async function(sessionID) {
    const session = await db.sessions.findOne({_id: sessionID})

    if (!session) {
      return null
    }

    const user = await db.users.findOne({_id: session.user})

    if (!user) {
      return null
    }

    return user
  }

  const getUserIDBySessionID = async function(sessionID) {
    // Gets the user ID of a session (by the session's ID).
    // This uses one less database request than getUserBySessionID, since it
    // does not actually request the stored user data.

    const session = await db.sessions.findOne({_id: sessionID})

    if (!session) {
      return null
    }

    return session.user
  }

  const getDateAsISOString = function() {
    return (new Date()).toISOString()
  }

  const loadVarsFromRequestObject = function(object, request, response, next) {
    // TODO: Actually implement the variable system..!
    request[middleware.vars] = {}

    for (const [ key, value ] of Object.entries(object)) {
      request[middleware.vars][key] = value
    }

    next()
  }

  const middleware = {
    vars: Symbol('Middleware variables'),

    verifyVarsExists: () => [
      // Makes sure the vars dictionary is actually a thing stored on the request.
      // If it isn't, this creates it.

      function(request, response, next) {
        if (middleware.vars in request === false) {
          request[middleware.vars] = {}
        }

        next()
      }
    ],

    loadVarFromBody: (key, required = true) => [
      // Takes a value from the given body object and stores it as a variable.
      // If the 'required' argument is set to true and the key is not found in
      // the request's body, an error message is shown in response.

      ...middleware.verifyVarsExists(),

      function(request, response, next) {
        if (required && (key in request.body === false)) {
          response.status(400).end(JSON.stringify({
            error: `${key} field missing`
          }))

          return
        }

        request[middleware.vars][key] = request.body[key]
        next()
      }
    ],

    loadVarFromParams: key => [
      // Same as loadVarFromBody, but it loads from the request's params.
      // Use this for GET requests where the parameter is labeled in the URL,
      // e.g .get('/api/message/:messageID').

      ...middleware.verifyVarsExists(),

      function(request, response, next) {
        request[middleware.vars][key] = request.params[key]
        next()
      }
    ],

    getSessionUserFromID: (sessionIDVar, sessionUserVar) => [
      async function(request, response, next) {
        const sessionID = request[middleware.vars][sessionIDVar]

        if (!sessionID) {
          response.status(400).end(JSON.stringify({
            error: 'missing sessionID field'
          }))

          return
        }

        const user = await getUserBySessionID(sessionID)

        if (!user) {
          response.status(401).end(JSON.stringify({
            error: 'invalid session ID'
          }))

          return
        }

        request[middleware.vars][sessionUserVar] = user

        next()
      }
    ],

    getUserFromUsername: (usernameVar, userVar) => [
      async function(request, response, next) {
        const username = request[middleware.vars][usernameVar]
        const user = await db.users.findOne({username})

        if (!user) {
          response.status(404).end(JSON.stringify({
            error: 'user not found'
          }))

          return
        }

        request[middleware.vars][userVar] = user

        next()
      }
    ],

    getMessageFromID: (messageIDVar, messageVar) => [
      async function(request, response, next) {
        const messageID = request[middleware.vars][messageIDVar]

        if (!messageID) {
          response.status(400).end(JSON.stringify({
            error: 'missing messageID field'
          }))

          return
        }

        const message = await db.messages.findOne({_id: messageID})

        if (!message) {
          response.status(404).end(JSON.stringify({
            error: 'message not found'
          }))

          return
        }

        request[middleware.vars][messageVar] = message

        next()
      }
    ],

    getChannelFromID: (channelIDVar, channelVar) => [
      async function(request, response, next) {
        const channelID = request[middleware.vars][channelIDVar]

        const channel = await db.channels.findOne({_id: channelID})

        if (!channel) {
          response.status(404).end(JSON.stringify({
            error: 'channel not found'
          }))

          return
        }

        request[middleware.vars][channelVar] = channel

        next()
      }
    ],

    requireBeAdmin: userVar => [
      async function(request, response, next) {
        const { permissionLevel } = request[middleware.vars][userVar]

        if (permissionLevel !== 'admin') {
          response.status(403).end(JSON.stringify({
            error: 'you are not an admin'
          }))

          return
        }

        next()
      }
    ],

    requireBeMessageAuthor: (messageVar, userVar) => [
      async function(request, response, next) {
        const message = request[middleware.vars][messageVar]
        const user = request[middleware.vars][userVar]

        if (message.authorID !== user._id) {
          response.status(403).end(JSON.stringify({
            error: 'you are not the author of this message'
          }))

          return
        }

        next()
      }
    ]
  }

  app.use(bodyParser.json())

  app.get('/', (req, res) => {
    res.sendFile(__dirname + '/site/index.html')
  })

  app.use('/api/*', async (request, response, next) => {
    response.header('Content-Type', 'application/json')

    next()
  })

  app.post('/api/send-message', [
    ...middleware.loadVarFromBody('text'),
    ...middleware.loadVarFromBody('channelID'),
    ...middleware.loadVarFromBody('signature', false),
    ...middleware.loadVarFromBody('sessionID'),
    ...middleware.getSessionUserFromID('sessionID', 'sessionUser'),

    async (request, response) => {
      const { text, signature, channelID, sessionUser } = request[middleware.vars]

      const message = await db.messages.insert({
        authorID: sessionUser._id,
        authorUsername: sessionUser.username,
        date: getDateAsISOString(),
        channelID: channelID,
        revisions: [
          {
            text: request.body.text,
            signature: request.body.signature,
            date: getDateAsISOString()
          }
        ],
        reactions: {}
      })

      Array.from(socketChannelMap.entries())
        .filter(([ socket, socketChannelID ]) => socketChannelID === channelID)
        .forEach(([ socket ]) => socket.emit('received chat message', {message}))

      response.status(201).end(JSON.stringify({
        success: true,
        messageID: message._id
      }))
    }
  ])

  app.post('/api/add-message-reaction', [
    ...middleware.loadVarFromBody('reactionCode'),
    ...middleware.loadVarFromBody('sessionID'),
    ...middleware.loadVarFromBody('messageID'),
    ...middleware.getSessionUserFromID('sessionID', 'sessionUser'),
    ...middleware.getMessageFromID('messageID', 'message'),

    async (request, response) => {
      const { reactionCode, message, sessionUser: { _id: userID } } = request[middleware.vars]

      if (reactionCode.length !== 1) {
        response.status(400).end(JSON.stringify({
          error: 'reactionCode should be 1-character string'
        }))

        return
      }

      let newReactionCount

      if (reactionCode in message.reactions) {
        if (message.reactions[reactionCode].includes(userID)) {
          response.status(500).end(JSON.stringify({
            error: 'you already reacted with this'
          }))

          return
        }

        const [ numAffected, newMessage ] = await db.messages.update({_id: message._id}, {
          $push: {
            [`reactions.${reactionCode}`]: userID
          }
        }, {
          multi: false,
          returnUpdatedDocs: true
        })

        newReactionCount = newMessage.reactions[reactionCode].length
      } else {
        await db.messages.update({_id: message._id}, {
          $set: {
            [`reactions.${reactionCode}`]: [userID]
          }
        })

        newReactionCount = 1
      }

      response.status(200).end(JSON.stringify({
        success: true,
        newCount: newReactionCount
      }))
    }
  ])

  app.post('/api/edit-message', [
    ...middleware.loadVarFromBody('sessionID'),
    ...middleware.loadVarFromBody('messageID'),
    ...middleware.loadVarFromBody('text'),
    ...middleware.loadVarFromBody('signature', false),
    ...middleware.getSessionUserFromID('sessionID', 'sessionUser'),
    ...middleware.getMessageFromID('messageID', 'oldMessage'),
    ...middleware.requireBeMessageAuthor('oldMessage', 'sessionUser'),

    async (request, response) => {
      const { text, signature, oldMessage, sessionUser: { _id: userID } } = request[middleware.vars]

      if (userID !== oldMessage.authorID) {
        response.status(403).end(JSON.stringify({
          error: 'you are not the owner of this message'
        }))

        return
      }

      const [ numAffected, newMessage ] = await db.messages.update({_id: oldMessage._id}, {
        $push: {
          revisions: {
            text, signature,
            date: getDateAsISOString()
          }
        }
      }, {
        multi: false,
        returnUpdatedDocs: true
      })

      io.emit('edited chat message', {message: newMessage})

      response.status(200).end(JSON.stringify({success: true}))
    }
  ])

  app.get('/api/message/:messageID', [
    ...middleware.loadVarFromParams('messageID'),
    ...middleware.getMessageFromID('messageID', 'message'),

    async (request, response) => {
      const { message } = request[middleware.vars]

      response.status(200).end(JSON.stringify(message))
    }
  ])

  app.post('/api/release-public-key', [
    ...middleware.loadVarFromBody('key'),
    ...middleware.loadVarFromBody('sessionID'),
    ...middleware.getSessionUserFromID('sessionID', 'sessionUser'),

    async (request, response) => {
      const { key, sessionUser: { username } } = request[middleware.vars]

      if (!key) {
        response.status(400).end(JSON.stringify({
          error: 'missing key field'
        }))

        return
      }

      io.emit('released public key', {key, username})

      response.status(200).end(JSON.stringify({
        success: true
      }))
    }
  ])

  app.post('/api/create-channel', [
    ...middleware.loadVarFromBody('name'),
    ...middleware.loadVarFromBody('sessionID'),
    ...middleware.getSessionUserFromID('sessionID', 'sessionUser'),
    ...middleware.requireBeAdmin('sessionUser'),

    async (request, response) => {
      const { name } = request[middleware.vars]

      if (await db.channels.findOne({name})) {
        response.status(500).end(JSON.stringify({
          error: 'channel name already taken'
        }))

        return
      }

      const channel = await db.channels.insert({
        name
      })

      response.status(201).end(JSON.stringify({
        success: true,
        channel
      }))
    }
  ])

  app.get('/api/channel-list', async (request, response) => {
    const channels = await db.channels.find({}, {name: 1})

    response.status(200).end(JSON.stringify({
      success: true,
      channels
    }))
  })

  app.post('/api/register', [
    ...middleware.loadVarFromBody('username'),
    ...middleware.loadVarFromBody('password'),

    async (request, response) => {
      const { username, password } = request[middleware.vars]
      const reValidUsername = /^[a-zA-Z0-9_-]+$/g

      if (!reValidUsername.test(username)) {
        response.status(400).end(JSON.stringify({
          error: 'username invalid'
        }))

        return
      }

      if (await db.users.findOne({username})) {
        response.status(500).end(JSON.stringify({
          error: 'username already taken'
        }))

        return
      }

      if (password.length < 6) {
        response.status(400).end(JSON.stringify({
          error: 'password must be at least 6 characters long'
        }))

        return
      }

      const salt = await bcrypt.genSalt()
      const passwordHash = await bcrypt.hash(password, salt)

      const user = await db.users.insert({
        username,
        passwordHash,
        permissionLevel: 'member',
        salt
      })

      response.status(201).end(JSON.stringify({
        success: true,
        username: username,
        id: user._id,
      }))
    }
  ])

  app.get('/api/user/:userID', [
    ...middleware.loadVarFromParams('userID'),

    async (request, response) => {
      const { userID } = request[middleware.vars]

      const user = await db.users.findOne({_id: userID})

      if (!user) {
        response.status(404).end(JSON.stringify({
          error: 'user not found'
        }))

        return
      }

      // TODO: Duplicated code...
      delete user.passwordHash
      delete user.salt

      response.status(200).end(JSON.stringify({
        success: true,
        user
      }))
    }
  ])

  app.post('/api/login', [
    ...middleware.loadVarFromBody('username'),
    ...middleware.loadVarFromBody('password'),
    ...middleware.getUserFromUsername('username', 'user'),

    async (request, response) => {
      const { username, password, user } = request[middleware.vars]
      const { salt, passwordHash } = user

      if (await bcrypt.compare(password, passwordHash)) {
        const session = await db.sessions.insert({
          _id: uuidv4(),
          user: user._id
        })

        response.status(200).end(JSON.stringify({
          sessionID: session._id
        }))
      } else {
        response.status(401).end(JSON.stringify({
          error: 'incorrect password'
        }))
      }
    }
  ])

  app.get('/api/session/:sessionID', [
    ...middleware.loadVarFromParams('sessionID'),

    async (request, response) => {
      const { sessionID } = request[middleware.vars]
      const user = await getUserBySessionID(sessionID)

      if (!user) {
        response.status(404).end(JSON.stringify({
          error: 'session not found'
        }))

        return
      }

      // Don't give the following away, even to the user themselves.
      // They should never have a use for them regardless of security.
      delete user.passwordHash
      delete user.salt

      response.status(200).end(JSON.stringify({
        success: true,
        user
      }))
    }
  ])

  io.on('connection', socket => {
    socketChannelMap.set(socket, null)

    socket.on('view channel', channelID => {
      if (!channelID) {
        return
      }

      socketChannelMap.set(socket, channelID)
    })

    io.on('disconnect', () => {
      socketChannelMap.delete(socket)
    })
  })
}
