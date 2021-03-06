// message list component
const css = require('sheetify')
const html = require('choo/html')
const api = require('../util/api')
const messageGroup = require('./message-group')
const prism = require('prismjs')

// groups messages where:
//  * the messages have the same author
//  * the group has <= 20 messages
//  * the messages are < 30 min apart (TODO configurable by client)
const groupMessages = (msgs, startingGroups = []) => {
  const groups = startingGroups

  // milliseconds between messages (30min)
  const apart = 30 * 60 * 1000 // TODO make this per-user/client via storage

  for (const msg of msgs) {
    const group = groups[groups.length - 1]

    const useLastGroup = typeof group !== 'undefined'
      && group.authorID === msg.authorID
      && group.messages.length <= 20
      && (msg.date - group.messages[group.messages.length - 1].date) < apart

    if (!useLastGroup) {
      // create a new group for this message
      msg.group = groups.length
      groups.push({
        authorID: msg.authorID,
        authorUsername: msg.authorUsername,
        authorAvatarURL: msg.authorAvatarURL,
        messages: [ msg ],
        id: 'msg-group-' + msg.date,
      })
    } else {
      // add this message to the last group
      msg.group = groups.length - 1
      group.messages.push(msg)
      group.id = 'msg-group-' + msg.date // having an id makes nanomorph go quicker
    }
  }

  return groups
}

const store = (state, emitter) => {
  const reset = () => state.messages = {
    // array of message objects
    list: null,

    // cached array of message groups
    groupsCached: [],

    // are we currently fetching messages?
    fetching: false,

    // true if we've fetched all messages up to the beginning
    // of the channel. used for scrollback
    fetchedAll: false,

    // the oldest message el's y coordinate relative to this component
    // used for scrollback
    oldestY: 0,

    // whether we should handle scroll events or not, which in turn
    // updates oldestY
    handleScroll: true,

    // oldest message in list
    get oldest() {
      if (!state.messages.list) return null

      return state.messages.list[0] || null
    },

    // this component's element
    get el() {
      return document.querySelector('.' + prefix)
    },

    // returns true if we are ~scrolled to the bottom of chat
    isScrolledToBottom() {
      const m = state.messages.el

      if (!m) return true

      const targetY = m.scrollHeight - m.clientHeight
      const currentY = m.scrollTop
      const difference = targetY - currentY

      return difference < 200
    },

    // oldest message-group element
    get oldestGroupEl() {
      return document.querySelector('.' + messageGroup.prefix + ':first-child')
    },

    // newest message-group element
    get newestGroupEl() {
      return document.querySelector('.' + messageGroup.prefix + ':last-child')
    },

    // scroll to message smoothly
    scrollToMsg({ id }, opts = {}) {
      const el = document.querySelector('#msg-' + id)

      el.scrollIntoView(Object.assign({
        behavior: 'instant',
        block: 'center',
      }, opts))
    },
  }

  reset() // setup initial state

  // reset component
  emitter.on('messages.reset', () => {
    reset()
    emitter.emit('render')
  })

  // load more messages from the past - used for scrollback
  // and also initial loading
  emitter.on('messages.fetch', async () => {
    // no need to fetch more - we've already fetched every
    // message in this channel!
    if (state.messages.fetchedAll) return

    // if we're currently fetching messages, don't try
    // and fetch even more as we'll run into edge cases
    if (state.messages.fetching) return

    // if the server requires authorization and we aren't authorized,
    // we obviously won't get anything back from the server, so don't
    // try to fetch
    if (!state.sessionAuthorized) return

    state.messages.fetching = true
    emitter.emit('render')

    // fetch messages before the oldest message we have. if we don't have an oldest message (i.e. list.length == 0)
    // then we will just fetch the latest messages via no `before` parameter
    const { oldest, oldestGroupEl: oldestGroupElBefore } = state.messages
    const { messages } = await api.get(state, `channel/${state.params.channel}/latest-messages`, oldest ? {
      before: oldest.id,
    } : {})

    if (messages.length) {
      state.messages.fetching = false
      state.messages.handleScroll = false
      state.messages.list = [ ...messages, ...(state.messages.list || []) ]
      state.messages.groupsCached = groupMessages(state.messages.list)

      // render the new messages!
      emitter.emit('render')
      emitter.emit('message.fetchcomplete')

      // note: there is currently no way to run something after the render executes - see choojs/choo#612
      setTimeout(() => {
        if (oldest) {
          // keep relative scroll position after scrollback
          const distance = state.messages.oldestY

          oldestGroupElBefore.scrollIntoView({ behaviour: 'instant' })
          state.messages.el.scrollTop -= distance
        } else {
          // scroll to bottom (initial render)
          state.messages.el.scrollTop = state.messages.el.scrollHeight + 999
        }

        state.messages.handleScroll = true

        // highlight code blocks
        prism.highlightAllUnder(state.messages.el)
      }, 25)
    } else {
      // no past messages means we've scrolled to the beginning, so we set
      // this flag which will stop all this code handling scrollback from
      // happening again (until we move to a different channel)
      state.messages.fetchedAll = true

      if (!state.messages.list) {
        state.messages.list = []
        state.messages.groupsCached = []
        emitter.emit('render')
      }
    }
  })

  // when the url changes, load the new channel
  // FIXME: don't assume that the channel actually changed
  emitter.on('routeready', () => {
    emitter.emit('messages.reset')

    if (state.params.channel) {
      emitter.emit('messages.fetch')
    }
  })

  emitter.on('login', () => {
    if (state.params.channel) {
      emitter.emit('messages.fetch')
    }
  })

  // after logging out, consider all messages gone, if the server requires
  // authentication - after all, they wouldn't be visible to somebody just
  // opening the page (while logged out)
  emitter.on('logout', () => {
    if (state.serverRequiresAuthorization && state.params.channel) {
      state.messages.list = []
      state.messages.groupsCached = []
      emitter.emit('render')
    }
  })

  // event: new message
  emitter.on('ws.receivedchatmessage', ({ message }) => {
    if (message.channelID !== state.params.channel) return

    const groups = state.messages.groupsCached
    const atBottom = state.messages.isScrolledToBottom()

    state.messages.groupsCached = groupMessages([ message ], groups) // we dont need to re-process the entire message list :tada:
    state.messages.list.push(message)

    emitter.emit('render')

    // scroll new message into view if we were at the bottom beforehand
    setTimeout(() => {
      if (atBottom) {
        const el = state.messages.newestGroupEl

        prism.highlightAllUnder(el)

        el.scrollIntoView({
          behavior: 'instant',
          block: 'end',
        })

        let img
        if (img = el.querySelector('.image:last-of-type img')) {
          // if the message has an image in it, wait for the image to load,
          // then scroll down to it
          img.addEventListener('load', () => {
            setTimeout(() => {
              state.messages.scrollToMsg(message)
            }, 25)
          })
        }
      }
    }, 25)
  })

  // event: edit message
  emitter.on('ws.editedchatmessage', ({ message: msg }) => {
    if (msg.channelID !== state.params.channel) return

    // optimization :tada:
    const msgInList = state.messages.list.find(m => m.id === msg.id)
    const msgInGroup = state.messages.groupsCached[msgInList.group].messages.find(m => m.id === msg.id)

    Object.assign(msgInGroup, msg)
    Object.assign(msgInList, msg)

    emitter.emit('render')

    setTimeout(() => {
      prism.highlightAllUnder(document.querySelector('#msg-' + msg.id))
    }, 25)
  })
}

const prefix = css('./messages.css')

const component = (state, emit) => {
  const { list: messages, fetching } = state.messages

  const handleScroll = evt => {
    if (!state.messages.handleScroll) return

    // the scroll event happens when the messages container is cleared,
    // too, at which point oldestGroupEl won't be set, so we don't do
    // anything in that case
    if (!state.messages.oldestGroupEl) return

    const y = state.messages.oldestY = state.messages.oldestGroupEl.getBoundingClientRect().y

    // if y is positive, we've scolled above the top group - so we need
    // to fetch older messages and display 'em
    if (y > 0) {
      emit('messages.fetch')
    }
  }

  if (state.messages.isScrolledToBottom()) {
    // scroll to bottom after re-render
    setTimeout(() => {
      state.messages.el.scrollTop = state.messages.el.scrollHeight + 999
    }, 50)
  }

  if (messages === null) {
    return html`<div class=${prefix}>Messages not loaded.</div>`
  } else {
    const groups = state.messages.groupsCached

    return html`<div class='${prefix} has-messages' onscroll=${handleScroll}>
      ${groups.map(group =>
          messageGroup.component(state, emit, group))}
    </div>`
  }
}

module.exports = { store, component, prefix }
