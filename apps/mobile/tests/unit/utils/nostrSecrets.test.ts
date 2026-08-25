import { type Account } from '@/types/models/Account'
import { type NostrAccount } from '@/types/models/Nostr'
import {
  clearNostrSecretsCaches,
  loadAccountNostrSecrets,
  looksLikePlaintextMnemonic,
  looksLikePlaintextNsec,
  mergeAccountWithCachedNostrSecrets,
  setCachedAccountSecrets,
  stripAccountSecretsForDb
} from '@/utils/nostrSecrets'

describe('looksLikePlaintextNsec', () => {
  it('detects bech32 nsec', () => {
    expect(looksLikePlaintextNsec('nsec1abc')).toBe(true)
  })

  it('rejects empty and non-nsec', () => {
    expect(looksLikePlaintextNsec('')).toBe(false)
    expect(looksLikePlaintextNsec('npub1abc')).toBe(false)
    expect(looksLikePlaintextNsec(undefined)).toBe(false)
  })
})

describe('looksLikePlaintextMnemonic', () => {
  it('detects 12+ word phrases', () => {
    expect(
      looksLikePlaintextMnemonic(
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
      )
    ).toBe(true)
  })

  it('rejects short strings', () => {
    expect(looksLikePlaintextMnemonic('hello world')).toBe(false)
    expect(looksLikePlaintextMnemonic(undefined)).toBe(false)
  })
})

describe('stripAccountSecretsForDb', () => {
  it('clears secret fields', () => {
    const nostr: NostrAccount = {
      autoSync: true,
      commonNpub: 'npub1',
      commonNsec: 'nsec1secret',
      deviceMnemonic: 'word '.repeat(12).trim(),
      deviceNpub: 'npub2',
      deviceNsec: 'nsec1device',
      dms: [],
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
      trustedMemberDevices: []
    }

    expect(stripAccountSecretsForDb(nostr)).toMatchObject({
      commonNpub: 'npub1',
      commonNsec: '',
      deviceMnemonic: undefined,
      deviceNpub: 'npub2',
      deviceNsec: undefined
    })
  })
})

describe('mergeAccountWithCachedNostrSecrets', () => {
  afterEach(() => {
    clearNostrSecretsCaches()
  })

  it('merges cached secrets into account.nostr', () => {
    setCachedAccountSecrets('acc-1', {
      commonNsec: 'nsec1fromcache',
      deviceNsec: 'nsec1device'
    })

    const account = {
      id: 'acc-1',
      nostr: {
        autoSync: false,
        commonNpub: 'npub1',
        commonNsec: '',
        dms: [],
        lastUpdated: new Date(),
        relays: [],
        syncStart: new Date(),
        trustedMemberDevices: []
      }
    } as Account

    expect(mergeAccountWithCachedNostrSecrets(account).nostr).toMatchObject({
      commonNsec: 'nsec1fromcache',
      deviceNsec: 'nsec1device'
    })
  })
})

describe('loadAccountNostrSecrets', () => {
  afterEach(() => {
    clearNostrSecretsCaches()
  })

  it('serves the cache when no explicit key is given', async () => {
    setCachedAccountSecrets('acc-1', { commonNsec: 'nsec1fromcache' })

    await expect(loadAccountNostrSecrets('acc-1')).resolves.toMatchObject({
      commonNsec: 'nsec1fromcache'
    })
  })

  it('bypasses the cache when an explicit key is given', async () => {
    // After a PIN change the cache still holds secrets decrypted under the old
    // key. A caller passing a key must hit SecureStore so a mismatch surfaces
    // instead of being masked by stale plaintext.
    setCachedAccountSecrets('acc-1', { commonNsec: 'nsec1fromcache' })

    await expect(
      loadAccountNostrSecrets('acc-1', 'some-other-key')
    ).resolves.toBeNull()
  })
})
