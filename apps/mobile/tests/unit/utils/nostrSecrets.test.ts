import {
  storeNostrAccountSecret,
  storeNostrIdentitySecret
} from '@/storage/encrypted'
import { type Account } from '@/types/models/Account'
import { type NostrAccount } from '@/types/models/Nostr'
import { aesDecrypt } from '@/utils/crypto'
import {
  clearNostrSecretsCaches,
  getCachedAccountSecrets,
  getCachedIdentitySecrets,
  loadAccountNostrSecrets,
  loadIdentitySecrets,
  looksLikePlaintextMnemonic,
  looksLikePlaintextNsec,
  mergeAccountWithCachedNostrSecrets,
  setCachedAccountSecrets,
  stripAccountSecretsForDb
} from '@/utils/nostrSecrets'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  ...jest.requireActual<typeof import('@/utils/crypto')>('@/utils/crypto'),
  aesDecrypt: jest.fn()
}))

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

  it('returns decrypted secrets that match the expected shape', async () => {
    await storeNostrAccountSecret('acc-valid', 'ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(
        JSON.stringify({ commonNsec: 'nsec1common', deviceNsec: 'nsec1device' })
      )

    await expect(
      loadAccountNostrSecrets('acc-valid', 'pin')
    ).resolves.toStrictEqual({
      commonNsec: 'nsec1common',
      deviceNsec: 'nsec1device'
    })
  })

  it('treats decrypted secrets with an unexpected shape as missing', async () => {
    await storeNostrAccountSecret('acc-malformed', 'ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ commonNsec: 42 }))

    await expect(
      loadAccountNostrSecrets('acc-malformed', 'pin')
    ).resolves.toBeNull()
    expect(getCachedAccountSecrets('acc-malformed')).toBeUndefined()
  })
})

describe('loadIdentitySecrets', () => {
  afterEach(() => {
    clearNostrSecretsCaches()
  })

  it('returns decrypted secrets that match the expected shape', async () => {
    await storeNostrIdentitySecret('npub1valid', 'ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ nsec: 'nsec1identity' }))

    await expect(
      loadIdentitySecrets('npub1valid', 'pin')
    ).resolves.toStrictEqual({ nsec: 'nsec1identity' })
    expect(getCachedIdentitySecrets('npub1valid')).toStrictEqual({
      nsec: 'nsec1identity'
    })
  })

  it('treats decrypted secrets with an unexpected shape as missing', async () => {
    await storeNostrIdentitySecret('npub1malformed', 'ciphertext', 'iv')
    jest
      .mocked(aesDecrypt)
      .mockResolvedValueOnce(JSON.stringify({ nsec: ['nsec1identity'] }))

    await expect(
      loadIdentitySecrets('npub1malformed', 'pin')
    ).resolves.toBeNull()
    expect(getCachedIdentitySecrets('npub1malformed')).toBeUndefined()
  })
})
