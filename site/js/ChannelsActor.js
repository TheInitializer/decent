import Actor from './Actor.js'
import { get, post } from './api.js'

export default class ChannelsActor extends Actor {
  init() {
    this.on('update channel list', channels => {
      // Join the first channel if we're not already in one
      if (this.activeChannelID === null) {
        const defaultChannel = channels[0]

        if (defaultChannel) {
          this.viewChannel(defaultChannel.id)
        }
      }

      // Update UI
      this.populateSidebarList(channels)
    })

    // Show/hide the create channel button depending on session state
    this.actors.session.on('update', (loggedIn, sessionObj) => {
      const btn = document.getElementById('create-channel')

      if (!loggedIn || sessionObj.user.permissionLevel !== 'admin') {
        btn.style.display = 'none' 
      } else {
        btn.style.removeProperty('display')
      }
    })

    this.socket.on('created new channel', () => this.loadChannels())

    this.on('update active channel', channel => {
      document.title = '#' + channel.name
      this.populateSidebarList(this.channels)
    })

    document.getElementById('create-channel').addEventListener('click', async evt => {
      evt.preventDefault()

      let channelName

      try {
        channelName = await this.actors.modals.prompt(
          'Create channel', 'New channel name?', '',
          async name => {
            const reValid = /^[a-zA-Z0-9-]+$/

            if (name.length === 0) {
              throw 'Please enter a channel name.'
            } else if (!reValid.test(name)) {
              throw 'Channel names must be alphanumeric with dashes! No spaces.'
            }
          },
          'Create channel', 'Cancel')
      } catch(error) {
        if (error !== 'modal closed') {
          throw error
        }

        return
      }

      const res = await post('create-channel', {
        name: channelName,
        sessionID: this.actors.session.sessionID,
      })

      if (res.error) {
        await this.actors.modals.alert('Error creating channel', res.error)
      } else {
        // No emission here, because socket will emit
        // `created new channel` if successful.
      }

      return false
    })

    this.activeChannelID = null
  }

  go() {
    this.loadChannels()
  }

  getChannelByID(channelID) {
    return this.channels.find(c => c.id === channelID) || null
  }

  getChannelByName(channelName) {
    return this.channels.find(c => c.name === channelName) || null
  }

  viewChannel(channelID) {
    this.activeChannelID = channelID
    this.socket.emit('view channel', channelID)
    this.emit('update active channel', this.getChannelByID(channelID))
  }

  async loadChannels() {
    const { channels } = await get('channel-list')

    this.channels = channels
    this.emit('update channel list', channels)

    return channels
  }

  async populateSidebarList(channels) {
    const sidebarEl = document.querySelector('#sidebar')

    // Remove old channels list
    const oldListEl = sidebarEl.querySelector('#channels-list')
    if (oldListEl) {
      oldListEl.remove()
    }

    // Create (new) channels list
    const listEl = document.createElement('ul')
    listEl.id = 'channels-list'

    for (const channel of channels) {
      const el = document.createElement('li')
      el.classList.add('channel')
      el.appendChild(document.createTextNode('#' + channel.name))

      if (channel.id === this.activeChannelID) {
        el.classList.add('active')
      } else {
        el.addEventListener('click', () => {
          this.viewChannel(channel.id)
        })
      }

      listEl.appendChild(el)
    }

    sidebarEl.appendChild(listEl)
  }
}