module.exports = function(db, io) {
	var express = require('express')
	var router = express.Router()

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


	router.use('/*', async (request, response, next) => {
		response.header('Content-Type', 'application/json')

		next()
	})

	router.post('/send-message', async (request, response) => {
		const { text, signature, sessionID } = request.body

		if (!text || !sessionID) {
			response.status(400).end(JSON.stringify({
				error: 'missing text or sessionID field'
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

		const message = await db.messages.insert({
			authorID: user._id,
			authorUsername: user.username,
			date: Date.now(),
			revisions: [
				{
					text: request.body.text,
					signature: request.body.signature,
					date: Date.now()
				}
			]
		})

		io.emit('received chat message', {message})

		response.status(201).end(JSON.stringify({
			success: true
		}))
	})

	router.post('/edit-message', async (request, response) => {
		const { messageID, text, signature, sessionID } = request.body

		if (!sessionID || !messageID || !text) {
			response.status(200).end(JSON.stringify({
				error: 'missing sessionID, messageID, or text field'
			}))

			return
		}

		const userID = await getUserIDBySessionID(sessionID)

		if (!userID) {
			response.status(401).end(JSON.stringify({
				error: 'invalid session ID'
			}))
		}

		const oldMessage = await db.messages.findOne({_id: messageID})

		if (!oldMessage) {
			response.status(500).end(JSON.stringify({
				error: 'no message by given id'
			}))

			return
		}

		if (userID !== oldMessage.authorID) {
			response.status(403).end(JSON.stringify({
				error: 'you are not the owner of this message'
			}))

			return
		}

		const [ numAffected, newMessage ] = await db.messages.update({_id: messageID}, {
			$push: {
				revisions: {
					text, signature,
					date: Date.now()
				}
			}
		}, {
			multi: false,
			returnUpdatedDocs: true
		})

		io.emit('edited chat message', {message: newMessage})

		response.status(200).end(JSON.stringify({success: true}))
	})

	router.get('/message/:message', async (request, response) => {
		const message = await db.messages.findOne({_id: request.params.message})

		if (message) {
			response.status(200).end(JSON.stringify(message))
		} else {
			response.status(404).end(JSON.stringify({
				error: 'message not found'
			}))
		}
	})

	router.post('/release-public-key', async (request, response) => {
		const { key, sessionID } = request.body

		if (!key || !sessionID) {
			response.status(400).end(JSON.stringify({
				error: 'missing key or sessionID field'
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

		const { username } = user

		io.emit('released public key', {key, username})

		response.status(200).end(JSON.stringify({
			success: true
		}))
	})

	router.post('/create-channel', async (request, response) => {
		const { name, sessionID } = request.body

		if (!name || !sessionID) {
			response.status(400).end(JSON.stringify({
				error: 'missing name or sessionID field'
			}))

			return
		}

		const user = await getUserBySessionID(sessionID)

		if (!user) {
			response.status(401).end(JSON.stringify({
				error: 'invalid session id'
			}))

			return
		}

		const { permissionLevel } = user

		if (permissionLevel !== 'admin') {
			response.status(403).end(JSON.stringify({
				error: 'you are not an admin'
			}))

			return
		}

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
	})

	router.get('/channel-list', async (request, response) => {
		const channels = await db.channels.find({}, {name: 1})

		response.status(200).end(JSON.stringify({
			success: true,
			channels
		}))
	})

	router.post('/register', async (request, response) => {
		const { username } = request.body
		let { password } = request.body

		if (!username || !password) {
			response.status(400).end(JSON.stringify({
				error: 'missing username or password field'
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

		const salt = await bcryptGenSalt()
		const passwordHash = await bcryptHash(password, salt)
		password = ''

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
	})

	router.post('/login', async (request, response) => {
		const { username } = request.body
		let { password } = request.body

		const user = await db.users.findOne({username})

		if (!user) {
			response.status(404).end(JSON.stringify({
				error: 'user not found'
			}))
			return
		}

		const { salt, passwordHash } = user

		if (await bcryptCompare(password, passwordHash)) {
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
	})

	router.get('/session/:sessionID', async (request, response) => {
		const user = await getUserBySessionID(request.params.sessionID)

		if (!user) {
			response.status(404).end(JSON.stringify({
				error: 'session not found'
			}))

			return
		}

		response.status(200).end(JSON.stringify({
			success: true,
			user
		}))
	})

	return router;
};
