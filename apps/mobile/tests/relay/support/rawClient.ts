import { once } from 'node:events'

import type { Filter } from 'nostr-tools'
import WebSocket from 'ws'

const EVENT_PAYLOAD_INDEX = 2

type RelayMessage = unknown[]

type RawRelayClient = {
  send: (frame: unknown[]) => void
  waitFor: (
    predicate: (message: RelayMessage) => boolean
  ) => Promise<RelayMessage>
  query: (subId: string, filters: Filter[]) => Promise<unknown[]>
  received: () => RelayMessage[]
  closed: Promise<void>
  close: () => Promise<void>
}

function parseMessage(raw: WebSocket.RawData): RelayMessage {
  const parsed: unknown = JSON.parse(raw.toString())
  return Array.isArray(parsed) ? parsed : []
}

async function connectRawClient(url: string): Promise<RawRelayClient> {
  const socket = new WebSocket(url)
  const inbox: RelayMessage[] = []
  const waiters = new Set<(message: RelayMessage) => boolean>()

  async function waitForClose() {
    await once(socket, 'close')
  }

  const closed = waitForClose()

  socket.on('message', (raw) => {
    const message = parseMessage(raw)
    inbox.push(message)
    for (const waiter of waiters) {
      if (waiter(message)) {
        waiters.delete(waiter)
      }
    }
  })

  await once(socket, 'open')

  function waitFor(predicate: (message: RelayMessage) => boolean) {
    const alreadyReceived = inbox.find(predicate)
    if (alreadyReceived) {
      return Promise.resolve(alreadyReceived)
    }
    return new Promise<RelayMessage>((resolve) => {
      waiters.add((message) => {
        if (!predicate(message)) {
          return false
        }
        resolve(message)
        return true
      })
    })
  }

  async function query(subId: string, filters: Filter[]) {
    socket.send(JSON.stringify(['REQ', subId, ...filters]))
    await waitFor(([verb, id]) => verb === 'EOSE' && id === subId)
    return inbox
      .filter(([verb, id]) => verb === 'EVENT' && id === subId)
      .map((message) => message.at(EVENT_PAYLOAD_INDEX))
  }

  async function close() {
    if (socket.readyState === WebSocket.CLOSED) {
      return
    }
    socket.close()
    await closed
  }

  return {
    close,
    closed,
    query,
    received: () => [...inbox],
    send: (frame) => socket.send(JSON.stringify(frame)),
    waitFor
  }
}

export { connectRawClient }
export type { RawRelayClient, RelayMessage }
