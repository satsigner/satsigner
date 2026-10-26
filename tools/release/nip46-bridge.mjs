import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip44
} from 'nostr-tools'
import { WebSocket } from 'ws'

const KIND_NIP46 = 24_133

function randomSecret() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join(
    ''
  )
}

function createBunker(relayUrl) {
  const secretKey = generateSecretKey()
  const pubkey = getPublicKey(secretKey)
  const secret = randomSecret()
  const bunkerUrl = `bunker://${pubkey}?relay=${encodeURIComponent(relayUrl)}&secret=${secret}`
  return { bunkerUrl, pubkey, secret, secretKey }
}

function conversationKey(secretKey, peer) {
  return nip44.v2.utils.getConversationKey(secretKey, peer)
}

function connectRelay(relayUrl) {
  const socket = new WebSocket(relayUrl)
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(socket))
    socket.once('error', reject)
  })
}

function acceptConnect(params, secret, alreadyPaired) {
  const values = Array.isArray(params) ? params : []
  if (values.includes(secret)) {
    return true
  }
  return alreadyPaired
}

function startBridge({ relayUrl, bunker, userPubkey, onSign, log }) {
  let socket
  let paired = false

  async function open() {
    socket = await connectRelay(relayUrl)
    socket.send(
      JSON.stringify([
        'REQ',
        'bridge',
        {
          '#p': [bunker.pubkey],
          kinds: [KIND_NIP46],
          since: Math.floor(Date.now() / 1000) - 30
        }
      ])
    )
    socket.on('message', (raw) => {
      void onMessage(raw)
    })
    log('signer bridge listening\n')
  }

  async function onMessage(raw) {
    try {
      const frame = JSON.parse(raw.toString())
      if (frame[0] !== 'EVENT' || !frame[2]) {
        return
      }
      await handleEvent(frame[2])
    } catch (error) {
      log(`signer bridge: ${error.message}\n`)
    }
  }

  function reply(peer, payload) {
    const content = nip44.v2.encrypt(
      JSON.stringify(payload),
      conversationKey(bunker.secretKey, peer)
    )
    const signed = finalizeEvent(
      {
        content,
        created_at: Math.floor(Date.now() / 1000),
        kind: KIND_NIP46,
        tags: [['p', peer]]
      },
      bunker.secretKey
    )
    socket.send(JSON.stringify(['EVENT', signed]))
  }

  async function handleEvent(event) {
    if (event.pubkey === bunker.pubkey || event.kind !== KIND_NIP46) {
      return
    }
    const plain = nip44.v2.decrypt(
      event.content,
      conversationKey(bunker.secretKey, event.pubkey)
    )
    const request = JSON.parse(plain)
    if (typeof request.id !== 'string' || typeof request.method !== 'string') {
      return
    }
    const params = Array.isArray(request.params) ? request.params : []
    log(`signer bridge: ${request.method}\n`)
    try {
      const result = await answer(request.method, params)
      reply(event.pubkey, { id: request.id, result })
    } catch (error) {
      reply(event.pubkey, { error: error.message, id: request.id })
    }
  }

  async function answer(method, params) {
    if (method === 'connect') {
      const known = Array.isArray(params) && params.includes(bunker.secret)
      if (!acceptConnect(params, bunker.secret, paired)) {
        log('signer bridge: connect rejected\n')
        throw new Error('rejected bunker connect')
      }
      log(
        `signer bridge: connect accepted (${known ? 'secret' : 'existing session'})\n`
      )
      paired = true
      return 'ack'
    }
    if (method === 'ping') {
      return 'pong'
    }
    if (method === 'get_public_key') {
      return userPubkey
    }
    if (method === 'sign_event') {
      const signed = await onSign(params[0])
      return typeof signed === 'string' ? signed : JSON.stringify(signed)
    }
    throw new Error('method not allowed')
  }

  return {
    close() {
      socket?.close()
    },
    ready: open()
  }
}

export { acceptConnect, createBunker, startBridge }
