import Actor from './Actor.js'
import { get, post } from './api.js'

export default class SessionActor extends Actor {
  init() {
    this.sessionIDs = {}

    // When we connect to a new server, update the UI.
    this.on('switch server', hostname => {
      const currentServerEl = document.querySelector('#server-dropdown .dropdown-item.active')
      currentServerEl.innerText = hostname
    })

    // When there's a session update, update the UI too.
    this.on('update', (loggedIn, sessionObj) => {
      const [ registerEl, loginEl, logoutEl ] = document.querySelectorAll('.session-action-btn')
      const formEl = document.getElementById('form')

      // TODO: should probably use a CSS class at some app root level
      //       for showing/hiding the buttons based on login state.

      if (loggedIn) {
        registerEl.style.display = 'none'
        loginEl.style.display = 'none'
        logoutEl.style.removeProperty('display')
        formEl.style.removeProperty('display')

        document.querySelector('.user-info .user-name').innerText = sessionObj.user.username
      } else {
        registerEl.style.removeProperty('display')
        loginEl.style.removeProperty('display')
        logoutEl.style.display = 'none'
        formEl.style.display = 'none'
      }
    })

    document.querySelector('#add-server').addEventListener('click', async evt => {
      evt.preventDefault()
      evt.stopPropagation()

      const url = await this.actors.modals.prompt(
        'Add new server', 'Hostname?', window.location.host,
        async url => {
          if (url.trim().startsWith('http')) {
            throw 'Please leave off the HTTP protocol.'
          }
        },
        'Connect', 'Cancel').then(url => url.trim().toLowerCase())

      this.switchServer(url)
    })

    let serverListOpen = false
    document.querySelector('#server-dropdown .dropdown-item.active').addEventListener('click', async evt => {
      const serverListEl = document.getElementById('server-dropdown')

      evt.preventDefault()
      evt.stopPropagation()

      const closeFn = evt => {
        serverListOpen = false
        this.emit('close server list')

        serverListEl.classList.remove('open')
        document.removeEventListener('click', closeFn)
      }

      if (serverListOpen) {
        closeFn()
      } else {
        this.emit('open server list')
        serverListOpen = true

        serverListEl.classList.add('open')
        document.addEventListener('click', closeFn)
      }

      return false
    })

    document.getElementById('register').addEventListener('click', () => {
      this.promptRegister()
    })

    document.getElementById('login').addEventListener('click', () => {
      this.promptLogin()
    })

    document.getElementById('logout').addEventListener('click', () => {
      this.loadSessionID('')
    })
  }

  bindToSocket(socket) {
    socket.on('ping for data', () => {
      socket.send('pong data', {sessionID: this.sessionID})
    })
  }

  async initialLoad() {
    // Load session IDs from LocalStorage, if it has that data.
    if ('sessionIDs' in localStorage) {
      this.sessionIDs = JSON.parse(localStorage.sessionIDs)
    } else {
      this.sessionIDs = {}
      localStorage.sessionIDs = '{}'
    }

    if (typeof this.sessionIDs !== 'object' || Array.isArray(this.sessionIDs)) {
      this.sessionIDs = {}
      localStorage.sessionIDs = '{}'
    }

    await this.switchServer(window.location.host)
    return window.location.host
  }

  isCurrentUser(userID) {
    if (!this.loggedIn) return false
    else return this.sessionObj.user.id === userID
  }

  async rebuildServerList(servers) {
    const serverURLs = servers || Object.keys(this.sessionIDs)
    const serverListEl = document.getElementById('server-dropdown')

    // Cleanup
    for (const el of serverListEl.querySelectorAll('.dropdown-item')) {
      el.remove()
    }

    serverURLs.sort((a, b) => {
      // Bubble the current server URL to the top
      if (this.currentServerURL === a) {
        return -1 // move b down
      } else if (this.currentServerURL === b) {
        return +1 // move a up
      } else {
        return 0 // do nothing
      }
    })

    // Build
    for (const url of serverURLs) {
      const el = document.createElement('div')

      el.classList.add('dropdown-item')

      if (this.currentServerURL === url) {
        el.classList.add('active')
      }

      el.appendChild(document.createTextNode(url)) // TODO: get server name and display that instead

      el.addEventListener('click', () => {
        this.switchServer(url)
      })

      serverListEl.appendChild(el)
    }
  }

  async switchServer(url) {
    this.currentServerURL = url
    this.sessionID = this.sessionIDs[url] || ''

    await this.rebuildServerList()

    this.loadSessionID(this.sessionID)
    this.emit('switch server', url)
  }

  async loadSessionID(sessionID = '') {
    const sessionData = sessionID === ''
      ? { success: false } // No sessionID = logged out
      : await get('session/' + sessionID, this.currentServerURL)

    if (sessionData.success) {
      this.loggedIn = true
      this.sessionObj = sessionData
    } else {
      this.loggedIn = false
      this.sessionObj = {}
    }

    this.sessionID = sessionID
    this.sessionIDs[this.currentServerURL] = this.sessionID

    localStorage.sessionIDs = JSON.stringify(this.sessionIDs)
    this.emit('update', this.loggedIn, this.sessionObj)
  }

  async promptLogin() {
    let username, password

    try {
      username = await this.actors.modals.prompt(
        'Login', 'Username?', '',
        async name => {
          const reValid = /^[a-zA-Z0-9-_]+$/

          if (name.length === 0) {
            throw 'Please enter a username.'
          } else if (!reValid.test(name)) {
            throw 'Usernames cannot contain special characters other than - and _.'
          }
        },
        'Continue', 'Cancel')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('login cancel', 1)

        return
      } else {
        throw error
      }
    }

    try {
      password = await this.actors.modals.prompt(
        'Login', 'Password?', '',
        async pass => {
          if (pass.length === 0) {
            throw 'Please enter a password.'
          }
        },
        'Continue', 'Cancel', 'password')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('login cancel', 2)

        return
      } else {
        throw error
      }
    }

    const result = await post('login', {username, password}, this.currentServerURL)

    if (result.error) {
      if (result.error === 'user not found') {
        this.actors.modals.alert('Login failure', `There is no user with the username ${username}.`)
      } else if (result.error === 'incorrect password') {
        this.actors.modals.alert('Login failure', `Incorrect password!`)
      }
      return
    }

    await this.loadSessionID(result.sessionID)
  }

  async promptRegister() {
    let username, password

    try {
      username = await this.actors.modals.prompt(
        'Register', 'Username?', '',
        async name => {
          const reValid = /^[a-zA-Z0-9-_]+$/

          if (name.length === 0) {
            throw 'Please enter a username.'
          } else if (!reValid.test(name)) {
            throw 'Usernames cannot contain special characters other than - and _.'
          }

          const { available } = await get('username-available/' + name, this.currentServerURL)

          if (!available) {
            throw 'Username not available: ' + name
          }
        },
        'Continue', 'Cancel')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('registration cancel', 1)

        return
      } else {
        throw error
      }
    }

    try {
      password = await this.actors.modals.prompt(
        'Register', 'Password? Must be at least 6 characters long.', '',
        async pass => {
          if (pass.length === 0) {
            throw 'Please enter a password.'
          } else if (pass.length < 6) {
            throw 'Your password needs to be at least 6 characters long.'
          }
        },
        'Continue', 'Cancel', 'password')
    } catch(error) {
      if (error === 'modal closed') {
        this.emit('registration cancel', 2)

        return
      } else {
        throw error
      }
    }

    const result = await post('register', {username, password}, this.currentServerURL)

    if (result.error) {
      if (result.error === 'password must be at least 6 characters long') {
        // impossible
        this.actors.modals.alert(`Couldn't create account`, 'Password too short.')
      } else if (result.error === 'username already taken') {
        this.actors.modals.alert(`Couldn't create account`, 'Username already taken.')
      } else if (result.error === 'username invalid') {
        // impossible
        this.actors.modals.alert(`Couldn't create account`, 'Username is invalid.')
      }

      this.emit('registration error', result.error)
      return result.error
    }

    this.actors.modals.alert('Account created', `Success! Account ${username} created. Please login.`)
    this.emit('registration success', result.user)

    return result.user
  }
}
