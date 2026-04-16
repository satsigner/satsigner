class NDKPrivateKeySigner {
  constructor(privateKey) {
    this.privateKey = privateKey
  }

  user() {
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

  toNostrEvent() {
    return {
      content: this.content,
      created_at: this.created_at,
      id: this.id,
      kind: this.kind,
      pubkey: this.pubkey,
      sig: this.sig,
      tags: this.tags
    }
  }

  async sign() {
    this.sig = 'a'.repeat(128)
  }
}

class NDK {
  constructor(options = {}) {
    this.explicitRelayUrls = options.explicitRelayUrls || []
    this.pool = {
      connect: jest.fn().mockResolvedValue(undefined),
      connectedRelays() {
        return Array.from(this.relays.keys()).map((url) => ({
          publish: jest.fn().mockResolvedValue(undefined),
          url
        }))
      },
      relays: new Map()
    }
    this.signer = null
  }

  connect(_timeoutMs) {
    for (const url of this.explicitRelayUrls) {
      this.pool.relays.set(url, {
        publish: jest.fn().mockResolvedValue(undefined)
      })
    }
    return Promise.resolve()
  }

  fetchEvent() {
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
