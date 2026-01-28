class NDKPrivateKeySigner {
  constructor(privateKey) {
    this.privateKey = privateKey
  }

  async user() {
    const pubkeyHex = Buffer.from(this.privateKey).toString('hex').slice(0, 64)
    return { npub: `npub1${pubkeyHex.slice(0, 59)}` }
  }
}

class NDKEvent {
  constructor(ndk, event = {}) {
    this.ndk = ndk
    this.id = event.id || 'mock-event-id'
    this.content = event.content || ''
    this.kind = event.kind || 1
    this.created_at = event.created_at || Math.floor(Date.now() / 1000)
    this.pubkey = event.pubkey || 'mock-pubkey'
    this.tags = event.tags || []
    this.sig = event.sig || null
  }

  async toNostrEvent() {
    return {
      id: this.id,
      content: this.content,
      kind: this.kind,
      created_at: this.created_at,
      pubkey: this.pubkey,
      tags: this.tags,
      sig: this.sig
    }
  }

  async sign() {
    this.sig = 'mock-signature'
  }
}

class NDK {
  constructor(options = {}) {
    this.explicitRelayUrls = options.explicitRelayUrls || []
    this.pool = {
      relays: new Map(),
      connect: jest.fn().mockResolvedValue(undefined)
    }
    this.signer = null
  }

  async connect() {
    for (const url of this.explicitRelayUrls) {
      this.pool.relays.set(url, {
        publish: jest.fn().mockResolvedValue(undefined)
      })
    }
    return true
  }

  async fetchEvent() {
    return null
  }

  subscribe() {
    return {
      on: jest.fn(),
      stop: jest.fn()
    }
  }
}

export default NDK
export { NDKEvent, NDKPrivateKeySigner }
