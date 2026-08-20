import * as nodeCrypto from 'node:crypto'

import { __store as secureStore } from 'expo-secure-store'
import QuickCrypto from 'react-native-quick-crypto'

import {
  DURESS_KDF_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import {
  commitPinMaterial,
  derivePinDigest,
  getBestAvailableKdf,
  getStoredKdfConfig,
  kdfConfigsEqual,
  LEGACY_KDF_CONFIG,
  migratePinKdfIfNeeded,
  parseKdf,
  pinMatchesDuressDigest,
  preparePinMaterial,
  safeEqualHex,
  serializeKdf,
  storeKdfConfig
} from '@/utils/pinKdf'

const ARGON2_CONFIG = {
  memoryKiB: 65536,
  name: 'argon2id',
  parallelism: 4,
  passes: 3
} as const
const SCRYPT_CONFIG = { n: 32768, name: 'scrypt', p: 1, r: 8 } as const
const PBKDF2_600K = { iterations: 600_000, name: 'pbkdf2' } as const

const SALT = '00112233445566778899aabbccddeeff'
const PIN = '7391'

// storage/encrypted prefixes every SecureStore key with the storage version
const sk = (key: string) => `1_${key}`

function realPbkdf2(pin: string, salt: string, iterations: number): string {
  return nodeCrypto
    .pbkdf2Sync(pin, salt, iterations, 32, 'sha256')
    .toString('hex')
}
describe('pinKdf', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    jest
      .mocked(QuickCrypto.pbkdf2Sync)
      .mockImplementation(
        (pin: string, salt: string, iterations: number, keylen: number) =>
          nodeCrypto.pbkdf2Sync(pin, salt, iterations, keylen, 'sha256')
      )
  })

  describe('serializeKdf / parseKdf', () => {
    it('round-trips every config kind', () => {
      for (const config of [ARGON2_CONFIG, SCRYPT_CONFIG, PBKDF2_600K]) {
        expect(parseKdf(serializeKdf(config))).toStrictEqual(config)
      }
    })

    it('rejects malformed input', () => {
      expect(parseKdf('argon2id:m=abc')).toBeNull()
      expect(parseKdf('bcrypt:10')).toBeNull()
      expect(parseKdf('')).toBeNull()
    })

    it('kdfConfigsEqual compares semantically', () => {
      expect(kdfConfigsEqual(ARGON2_CONFIG, { ...ARGON2_CONFIG })).toBe(true)
      expect(kdfConfigsEqual(ARGON2_CONFIG, SCRYPT_CONFIG)).toBe(false)
    })
  })

  describe('getStoredKdfConfig', () => {
    it('returns the legacy config when nothing is stored', async () => {
      await expect(getStoredKdfConfig()).resolves.toStrictEqual(
        LEGACY_KDF_CONFIG
      )
    })

    it('returns the stored config and round-trips through storeKdfConfig', async () => {
      await storeKdfConfig(SCRYPT_CONFIG)
      await expect(getStoredKdfConfig()).resolves.toStrictEqual(SCRYPT_CONFIG)
    })

    it('falls back to legacy on corrupted data', async () => {
      secureStore[PIN_KDF_KEY] = 'not-a-kdf-config'
      await expect(getStoredKdfConfig()).resolves.toStrictEqual(
        LEGACY_KDF_CONFIG
      )
    })

    it('tracks the duress config independently', async () => {
      await storeKdfConfig(SCRYPT_CONFIG, DURESS_KDF_KEY)
      await expect(getStoredKdfConfig(DURESS_KDF_KEY)).resolves.toStrictEqual(
        SCRYPT_CONFIG
      )
      await expect(getStoredKdfConfig()).resolves.toStrictEqual(
        LEGACY_KDF_CONFIG
      )
    })
  })

  describe('derivePinDigest', () => {
    it('derives pbkdf2 digests compatible with the legacy implementation', async () => {
      const digest = await derivePinDigest(PIN, SALT, LEGACY_KDF_CONFIG)
      expect(digest).toBe(realPbkdf2(PIN, SALT, 10_000))
      expect(digest).toHaveLength(64)
    })

    it('derives scrypt digests matching node:crypto scrypt', async () => {
      const digest = await derivePinDigest(PIN, SALT, SCRYPT_CONFIG)
      const expected = nodeCrypto
        .scryptSync(PIN, SALT, 32, {
          N: SCRYPT_CONFIG.n,
          maxmem: 64 * 1024 * 1024,
          p: SCRYPT_CONFIG.p,
          r: SCRYPT_CONFIG.r
        })
        .toString('hex')
      expect(digest).toBe(expected)
      expect(QuickCrypto.scrypt).toHaveBeenCalledWith(
        PIN,
        SALT,
        32,
        expect.objectContaining({
          N: 32768,
          maxmem: 64 * 1024 * 1024,
          p: 1,
          r: 8
        }),
        expect.any(Function)
      )
    })

    it('derives distinct digests per KDF for the same pin and salt', async () => {
      const [a, b, c] = await Promise.all([
        derivePinDigest(PIN, SALT, ARGON2_CONFIG),
        derivePinDigest(PIN, SALT, SCRYPT_CONFIG),
        derivePinDigest(PIN, SALT, PBKDF2_600K)
      ])
      expect(new Set([a, b, c]).size).toBe(3)
    })
  })

  describe('safeEqualHex', () => {
    it('accepts equal strings', () => {
      expect(safeEqualHex('abcd', 'abcd')).toBe(true)
    })

    it('rejects different strings', () => {
      expect(safeEqualHex('abcd', 'abce')).toBe(false)
    })

    it('rejects different lengths and empty input', () => {
      expect(safeEqualHex('abcd', 'abc')).toBe(false)
      expect(safeEqualHex('', '')).toBe(false)
    })
  })

  describe('getBestAvailableKdf', () => {
    it('prefers argon2id when available', () => {
      expect(getBestAvailableKdf()).toStrictEqual(ARGON2_CONFIG)
    })
  })

  describe('kDF selection fallbacks', () => {
    // jest.resetModules yields a fresh mock registry; patching the fresh
    // QuickCrypto instance there is what the freshly required pinKdf will see.
    function requirePinKdfWithPatches(
      patch: (qc: Record<string, jest.Mock>) => void
    ) {
      jest.resetModules()
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const qc = require('react-native-quick-crypto').default
      patch(qc)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('@/utils/pinKdf')
    }

    afterEach(() => {
      jest.resetModules()
    })

    it('falls back to scrypt when argon2 is unavailable', () => {
      const pinKdf = requirePinKdfWithPatches((qc) => {
        qc.argon2Sync.mockImplementation(() => {
          throw new Error('native module missing')
        })
      })
      expect(pinKdf.getBestAvailableKdf()).toStrictEqual(SCRYPT_CONFIG)
    })

    it('falls back to pbkdf2 600k when argon2 is missing and production scrypt throws', () => {
      const pinKdf = requirePinKdfWithPatches((qc) => {
        qc.argon2Sync.mockImplementation(() => {
          throw new Error('native module missing')
        })
        qc.scryptSync.mockImplementation(
          (
            _password: string,
            _salt: string,
            _keylen: number,
            options?: { N?: number }
          ) => {
            if (options?.N === 32768) {
              throw new Error('maxmem')
            }
            return Buffer.alloc(32)
          }
        )
      })
      expect(pinKdf.getBestAvailableKdf()).toStrictEqual(PBKDF2_600K)
    })
  })

  describe('migratePinKdfIfNeeded', () => {
    it('migrates a legacy digest and re-encrypts secrets to the new digest', async () => {
      const legacyDigest = realPbkdf2(PIN, SALT, 10_000)
      secureStore[sk(PIN_KEY)] = legacyDigest
      // No PIN_KDF_KEY: pre-upgrade install

      const reEncrypt = jest.fn().mockResolvedValue(undefined)
      const newDigest = await migratePinKdfIfNeeded(
        PIN,
        SALT,
        legacyDigest,
        reEncrypt
      )

      expect(newDigest).not.toBeNull()
      expect(newDigest).toHaveLength(64)
      expect(reEncrypt).toHaveBeenCalledWith(legacyDigest, newDigest)
      expect(secureStore[sk(PIN_KEY)]).toBe(newDigest)
      expect(parseKdf(secureStore[sk(PIN_KDF_KEY)])).toStrictEqual(
        ARGON2_CONFIG
      )
    })

    it('is a no-op when already on the current KDF', async () => {
      const first = realPbkdf2(PIN, SALT, 10_000)
      secureStore[sk(PIN_KEY)] = first
      const reEncrypt = jest.fn().mockResolvedValue(undefined)
      await migratePinKdfIfNeeded(PIN, SALT, first, reEncrypt)

      const reEncrypt2 = jest.fn()
      const result = await migratePinKdfIfNeeded(
        PIN,
        SALT,
        secureStore[sk(PIN_KEY)],
        reEncrypt2
      )
      expect(result).toBeNull()
      expect(reEncrypt2).not.toHaveBeenCalled()
    })

    it('refuses to migrate with a wrong PIN and writes nothing', async () => {
      const legacyDigest = realPbkdf2(PIN, SALT, 10_000)
      secureStore[sk(PIN_KEY)] = legacyDigest

      const reEncrypt = jest.fn()
      const result = await migratePinKdfIfNeeded(
        '0000',
        SALT,
        legacyDigest,
        reEncrypt
      )

      expect(result).toBeNull()
      expect(reEncrypt).not.toHaveBeenCalled()
      expect(secureStore[sk(PIN_KEY)]).toBe(legacyDigest)
      expect(secureStore[sk(PIN_KDF_KEY)]).toBeUndefined()
    })
  })

  describe('preparePinMaterial / commitPinMaterial', () => {
    it('does not write until commit, and reuses an existing salt', async () => {
      secureStore[sk(SALT_KEY)] = SALT

      const material = await preparePinMaterial(PIN)
      expect(material.salt).toBe(SALT)
      expect(secureStore[sk(PIN_KEY)]).toBeUndefined()

      await commitPinMaterial(material)
      expect(secureStore[sk(PIN_KEY)]).toBe(material.digest)
      expect(secureStore[sk(SALT_KEY)]).toBe(SALT)
    })
  })

  describe('pinMatchesDuressDigest', () => {
    it('accepts a digest derived with the shared salt', async () => {
      secureStore[sk(SALT_KEY)] = SALT
      const digest = await derivePinDigest(PIN, SALT, LEGACY_KDF_CONFIG)
      await expect(pinMatchesDuressDigest(PIN, digest)).resolves.toBe(true)
      await expect(pinMatchesDuressDigest('0000', digest)).resolves.toBe(false)
    })

    it('accepts a pre-upgrade digest derived with SALT_KEY_DURESS', async () => {
      const legacySalt = 'ffeeddccbbaa99887766554433221100'
      secureStore[sk(SALT_KEY)] = SALT
      secureStore[sk(SALT_KEY_DURESS)] = legacySalt
      const digest = await derivePinDigest(PIN, legacySalt, LEGACY_KDF_CONFIG)
      await expect(pinMatchesDuressDigest(PIN, digest)).resolves.toBe(true)
    })
  })
})
