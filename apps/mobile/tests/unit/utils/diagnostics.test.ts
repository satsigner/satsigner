// A manual mock of nostr-tools (tests/__mocks__/nostr-tools.js) stub
// nip17/nip59 with fixed payloads — fine for sync tests, but these checks
// verify the real gift-wrap roundtrip, so use the actual module here.
jest.mock<typeof import('nostr-tools')>('nostr-tools', () =>
  jest.requireActual('nostr-tools')
)

// The shared quick-crypto mock backs the KDF, hash, and RNG APIs with
// node:crypto, but stubs cipher/decipher with fixed buffers. These checks
// verify a real AES roundtrip, so overlay real ciphers on the shared mock.
jest.mock<typeof import('react-native-quick-crypto')>(
  'react-native-quick-crypto',
  () => {
    const nodeCrypto = jest.requireActual('node:crypto')
    const shared = jest.requireActual(
      '../../../__mocks__/react-native-quick-crypto'
    ).default
    return {
      __esModule: true,
      default: {
        ...shared,
        createCipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
          nodeCrypto.createCipheriv(alg, key, iv),
        createDecipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
          nodeCrypto.createDecipheriv(alg, key, iv)
      }
    }
  }
)

import {
  checkCryptoRoundtrip,
  checkEntropyCollisions,
  checkNip17Roundtrip,
  checkPinKdf,
  checkSecureStore,
  checkSqlite,
  resolveLiveRoundtripRelays
} from '@/utils/diagnostics/coreChecks'

describe('diagnostics one-click checks', () => {
  it('crypto roundtrip passes', async () => {
    const result = await checkCryptoRoundtrip()
    expect(result.lines).toStrictEqual(expect.any(Array))
    expect(result.ok).toBe(true)
  })

  it('pin kdf passes', async () => {
    const result = await checkPinKdf()
    expect(result.ok).toBe(true)
  })

  it('secure store roundtrip passes', async () => {
    const result = await checkSecureStore()
    expect(result.ok).toBe(true)
  })

  it('sqlite check passes', async () => {
    const result = await checkSqlite()
    expect(result.ok).toBe(true)
  })

  it('nip-17 gift wrap roundtrip passes', async () => {
    const result = await checkNip17Roundtrip()
    expect(result.ok).toBe(true)
    expect(result.lines.join('\n')).toContain('kind 1059')
  })

  it('entropy collision test passes with real RNG output', async () => {
    const result = await checkEntropyCollisions()
    expect(result.lines.join('\n')).toContain('0 collisions')
    expect(result.ok).toBe(true)
  })

  it('live roundtrip relay resolution prefers configured relays', () => {
    expect(resolveLiveRoundtripRelays(['wss://mine.example'])).toStrictEqual([
      'wss://mine.example'
    ])
    const fallback = resolveLiveRoundtripRelays([])
    expect(fallback.length).toBeGreaterThanOrEqual(2)
    for (const url of fallback) {
      expect(url.startsWith('wss://')).toBe(true)
    }
  })
})
