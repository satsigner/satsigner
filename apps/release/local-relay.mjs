import { WebSocketServer } from 'ws'

const HOST = '127.0.0.1'
const PORT = 4718
const MAX_STORED_EVENTS = 200

function parseFrame(raw) {
  try {
    return JSON.parse(raw.toString())
  } catch {
    return null
  }
}

function matches(filter, event) {
  if (filter.kinds && !filter.kinds.includes(event.kind)) {
    return false
  }
  if (filter.authors && !filter.authors.includes(event.pubkey)) {
    return false
  }
  if (filter.since && event.created_at < filter.since) {
    return false
  }
  const tags = filter['#p']
  if (tags) {
    const found = event.tags.some(
      (tag) => tag[0] === 'p' && tags.includes(tag[1])
    )
    if (!found) {
      return false
    }
  }
  return true
}

function startLocalRelay(log) {
  const events = []
  const sockets = new Set()
  const subscriptions = new Map()
  const server = new WebSocketServer({ host: HOST, port: PORT })
  server.on('connection', (socket) => {
    const subs = new Map()
    subscriptions.set(socket, subs)
    sockets.add(socket)
    log('signer relay: client connected\n')
    socket.on('message', (raw) => {
      const frame = parseFrame(raw)
      if (!frame) {
        return
      }
      if (frame[0] === 'EVENT' && frame[1]) {
        const [, event] = frame
        events.push(event)
        if (events.length > MAX_STORED_EVENTS) {
          events.shift()
        }
        log(`signer relay: event kind ${event.kind}\n`)
        for (const peer of sockets) {
          for (const [id, filters] of subscriptions.get(peer) ?? []) {
            if (filters.some((filter) => matches(filter, event))) {
              peer.send(JSON.stringify(['EVENT', id, event]))
            }
          }
        }
        socket.send(JSON.stringify(['OK', event.id, true, '']))
        return
      }
      if (frame[0] === 'REQ' && typeof frame[1] === 'string') {
        const filters = frame.slice(2)
        subs.set(frame[1], filters)
        log('signer relay: subscription\n')
        for (const event of events) {
          if (filters.some((filter) => matches(filter, event))) {
            socket.send(JSON.stringify(['EVENT', frame[1], event]))
          }
        }
        socket.send(JSON.stringify(['EOSE', frame[1]]))
        return
      }
      if (frame[0] === 'CLOSE') {
        subs.delete(frame[1])
      }
    })
    socket.on('close', () => {
      sockets.delete(socket)
      subscriptions.delete(socket)
      log('signer relay: client left\n')
    })
  })
  return `ws://${HOST}:${PORT}`
}

export { startLocalRelay }
