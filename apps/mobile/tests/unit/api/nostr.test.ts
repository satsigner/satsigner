import { NostrAPI } from '@/api/nostr'

import { relays } from '../utils/nostr_samples'

jest.mock('nostr-tools')
jest.mock('@nostr-dev-kit/ndk')
jest.mock('react-native-aes-crypto')
jest.mock('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

describe('NostrAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateNostrKeys', () => {
    it('returns nsec, npub, and secretNostrKey', async () => {
      const keys = await NostrAPI.generateNostrKeys()
      expect(keys).toHaveProperty('nsec')
      expect(keys).toHaveProperty('npub')
      expect(keys).toHaveProperty('secretNostrKey')
    })

    it('returns valid key formats', async () => {
      const keys = await NostrAPI.generateNostrKeys()
      expect(keys.nsec).toMatch(/^nsec1[a-z0-9]+$/)
      expect(keys.npub).toMatch(/^npub1[a-z0-9]+$/)
      expect(keys.secretNostrKey).toBeInstanceOf(Uint8Array)
      expect(keys.secretNostrKey.length).toBe(32)
    })

    it('produces different keys each call', async () => {
      const keys1 = await NostrAPI.generateNostrKeys()
      const keys2 = await NostrAPI.generateNostrKeys()
      const keys3 = await NostrAPI.generateNostrKeys()

      expect(keys1.nsec).not.toBe(keys2.nsec)
      expect(keys2.nsec).not.toBe(keys3.nsec)
      expect(keys1.nsec).not.toBe(keys3.nsec)
    })
  })

  describe('constructor and getRelays', () => {
    it('uses default relays when empty array provided', () => {
      const api = new NostrAPI([])
      expect(api.getRelays()).toEqual(relays.default)
    })

    it('uses provided custom relays', () => {
      const api = new NostrAPI(relays.custom)
      expect(api.getRelays()).toEqual(relays.custom)
    })

    it('uses single relay', () => {
      const singleRelay = [relays.default[0]]
      const api = new NostrAPI(singleRelay)
      expect(api.getRelays()).toEqual(singleRelay)
    })
  })

  describe('setLoadingCallback', () => {
    it('accepts callback function', () => {
      const api = new NostrAPI(relays.custom)
      const callback = jest.fn()
      expect(() => api.setLoadingCallback(callback)).not.toThrow()
    })
  })
})
