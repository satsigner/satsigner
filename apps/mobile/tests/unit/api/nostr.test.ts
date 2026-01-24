import { NostrAPI } from '@/api/nostr'

jest.mock('nostr-tools')
jest.mock('@nostr-dev-kit/ndk')
jest.mock('react-native-aes-crypto')
jest.mock('sonner-native', () => ({
  toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() }
}))

const defaultRelays = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://relay.nostr.band',
  'wss://nostr.mom'
]

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
      expect(keys.nsec).toMatch(/^nsec1/)
      expect(keys.npub).toMatch(/^npub1/)
      expect(keys.secretNostrKey).toBeInstanceOf(Uint8Array)
      expect(keys.secretNostrKey.length).toBe(32)
    })

    it('produces different keys each call', async () => {
      const keys1 = await NostrAPI.generateNostrKeys()
      const keys2 = await NostrAPI.generateNostrKeys()
      expect(keys1.nsec).not.toBe(keys2.nsec)
    })
  })

  describe('constructor and getRelays', () => {
    it('uses default relays when empty array provided', () => {
      const api = new NostrAPI([])
      expect(api.getRelays()).toEqual(defaultRelays)
    })

    it('uses provided relays', () => {
      const customRelays = [
        'wss://custom1.relay.com',
        'wss://custom2.relay.com'
      ]
      const api = new NostrAPI(customRelays)
      expect(api.getRelays()).toEqual(customRelays)
    })
  })

  describe('setLoadingCallback', () => {
    it('accepts callback function', () => {
      const api = new NostrAPI(['wss://test.relay.com'])
      expect(() => api.setLoadingCallback(jest.fn())).not.toThrow()
    })
  })
})
