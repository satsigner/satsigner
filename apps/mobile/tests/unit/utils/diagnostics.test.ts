// A manual mock of nostr-tools (tests/__mocks__/nostr-tools.js) stub
// nip17/nip59 with fixed payloads — fine for sync tests, but these checks
// verify the real gift-wrap roundtrip, so use the actual module here.
jest.mock('nostr-tools', () => jest.requireActual('nostr-tools'))

// The shared quick-crypto mock stubs pbkdf2Sync with a constant output and
// cipher/decipher with fixed buffers, which makes real roundtrips impossible.
// These checks exist to verify *actual* crypto behaviour, so back the module
// with node:crypto here — mirroring the real-backed parts of the shared mock.
jest.mock('react-native-quick-crypto', () => {
  const nodeCrypto = jest.requireActual('node:crypto')
  return {
    __esModule: true,
    default: {
      argon2Sync: (
        _algorithm: string,
        params: {
          memory: number
          message: string
          nonce: string
          parallelism: number
          passes: number
          tagLength: number
        }
      ) =>
        nodeCrypto.scryptSync(
          params.message,
          `${params.nonce}|argon2id|${params.memory}|${params.passes}|${params.parallelism}`,
          params.tagLength
        ),
      createCipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
        nodeCrypto.createCipheriv(alg, key, iv),
      createDecipheriv: (alg: string, key: Uint8Array, iv: Uint8Array) =>
        nodeCrypto.createDecipheriv(alg, key, iv),
      createHash: (algorithm: string) => {
        const hash = nodeCrypto.createHash(algorithm)
        return {
          digest: () => hash.digest(),
          update(input: string) {
            hash.update(String(input))
            return this
          }
        }
      },
      pbkdf2Sync: (
        pin: string,
        salt: string,
        iterations: number,
        keylen: number,
        digest: string
      ) => nodeCrypto.pbkdf2Sync(pin, salt, iterations, keylen, digest),
      randomBytes: (size: number) => nodeCrypto.randomBytes(size),
      scryptSync: (
        password: string,
        salt: string,
        keylen: number,
        options?: { N?: number; p?: number; r?: number }
      ) =>
        nodeCrypto.scryptSync(password, salt, keylen, {
          ...options,
          maxmem: 256 * 1024 * 1024
        })
    }
  }
})

import {
  checkCryptoRoundtrip,
  checkNip17LiveRoundtrip,
  checkNip17Roundtrip,
  checkPinKdf,
  checkSecureStore,
  checkSqlite,
  DIAGNOSTIC_CHECKS,
  runDiagnosticCheck
} from '@/utils/diagnostics'

describe('diagnostics one-click checks', () => {
  it('crypto roundtrip passes', async () => {
    const result = await checkCryptoRoundtrip()
    expect(result.lines).toEqual(expect.any(Array))
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

  it('nip-17 live roundtrip fails cleanly with no relays configured', async () => {
    const result = await checkNip17LiveRoundtrip([])
    expect(result.ok).toBe(false)
    expect(result.lines.join('\n')).toContain('no relays configured')
  })

  it('every registered check runs and returns a result', async () => {
    for (const { id } of DIAGNOSTIC_CHECKS) {
      const result = await runDiagnosticCheck(id)
      expect(typeof result.ok).toBe('boolean')
      expect(result.lines.length).toBeGreaterThan(0)
    }
  })
})
