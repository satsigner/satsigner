import QuickCrypto from 'react-native-quick-crypto'

import {
  DURESS_KDF_KEY,
  PIN_KDF_KEY,
  PIN_KEY,
  PIN_LENGTH_KEY,
  SALT_KEY,
  SALT_KEY_DURESS
} from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'
import { generateSalt } from '@/utils/crypto'

/* oxlint-disable promise/prefer-await-to-callbacks -- QuickCrypto KDF APIs are callback-only */

/**
 * PIN key derivation.
 *
 * The stored PIN digest doubles as the AES-256 key for every key secret in
 * the app, so its cost directly bounds offline brute-force difficulty if the
 * device keystore is ever extracted. The legacy configuration (PBKDF2-SHA256,
 * 10k iterations) is weak against GPU attacks; new digests use Argon2id
 * (memory-hard, RFC 9106 first-choice parameters) when the native module is
 * available, falling back to scrypt and then to PBKDF2 with 600k iterations
 * (OWASP). The configuration used for each digest is persisted next to it so
 * verification stays possible across upgrades and migrations are explicit.
 */

export type PinKdfConfig =
  | {
      memoryKiB: number
      name: 'argon2id'
      parallelism: number
      passes: number
    }
  | { n: number; name: 'scrypt'; p: number; r: number }
  | { iterations: number; name: 'pbkdf2' }

export type PinMaterial = {
  digest: string
  kdf: PinKdfConfig
  length: number
  salt: string
}

const DIGEST_BYTES = 32

// RFC 9106 §4 first-choice: m=64 MiB, t=3, p=4.
const ARGON2ID_CONFIG: PinKdfConfig = {
  memoryKiB: 65536,
  name: 'argon2id',
  parallelism: 4,
  passes: 3
}

// scrypt N=2^15, r=8, p=1 (~32 MiB) — memory-hard fallback.
const SCRYPT_CONFIG: PinKdfConfig = { n: 32768, name: 'scrypt', p: 1, r: 8 }

// OpenSSL's default maxmem is 32 MiB; N=2^15/r=8 needs ~33.6 MiB.
const SCRYPT_MAXMEM_BYTES = 64 * 1024 * 1024

// OWASP minimum for PBKDF2-HMAC-SHA256.
const PBKDF2_CONFIG: PinKdfConfig = { iterations: 600_000, name: 'pbkdf2' }

// Digests written before KDF configs were tracked.
export const LEGACY_KDF_CONFIG: PinKdfConfig = {
  iterations: 10_000,
  name: 'pbkdf2'
}

const PREFERENCE_ORDER: PinKdfConfig[] = [
  ARGON2ID_CONFIG,
  SCRYPT_CONFIG,
  PBKDF2_CONFIG
]

function digestToHex(result: ArrayBufferView): string {
  return Buffer.from(
    new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
  ).toString('hex')
}

function deriveWithConfig(
  pin: string,
  salt: string,
  config: PinKdfConfig
): Promise<string> {
  switch (config.name) {
    case 'argon2id': {
      const params = {
        memory: config.memoryKiB,
        message: pin,
        nonce: salt,
        parallelism: config.parallelism,
        passes: config.passes,
        tagLength: DIGEST_BYTES
      }
      return new Promise((resolve, reject) => {
        QuickCrypto.argon2('argon2id', params, (err, result) => {
          if (err) {
            reject(err)
            return
          }
          resolve(digestToHex(result))
        })
      })
    }
    case 'scrypt': {
      const options = {
        N: config.n,
        maxmem: SCRYPT_MAXMEM_BYTES,
        p: config.p,
        r: config.r
      }
      return new Promise((resolve, reject) => {
        QuickCrypto.scrypt(
          pin,
          salt,
          DIGEST_BYTES,
          options,
          (err, derivedKey) => {
            if (err) {
              reject(err)
              return
            }
            if (!derivedKey) {
              reject(new Error('KDF returned no result'))
              return
            }
            resolve(digestToHex(derivedKey))
          }
        )
      })
    }
    case 'pbkdf2': {
      return new Promise((resolve, reject) => {
        QuickCrypto.pbkdf2(
          pin,
          salt,
          config.iterations,
          DIGEST_BYTES,
          'sha256',
          (err, derivedKey) => {
            if (err) {
              reject(err)
              return
            }
            if (!derivedKey) {
              reject(new Error('KDF returned no result'))
              return
            }
            resolve(digestToHex(derivedKey))
          }
        )
      })
    }
    default: {
      const _exhaustive: never = config
      throw new Error(`Unsupported KDF: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

const availabilityCache = new Map<string, boolean>()

function isKdfAvailable(config: PinKdfConfig): boolean {
  const cached = availabilityCache.get(config.name)
  if (cached !== undefined) {
    return cached
  }
  let available: boolean
  try {
    switch (config.name) {
      case 'argon2id':
        QuickCrypto.argon2Sync('argon2id', {
          memory: 8,
          message: 'probe',
          nonce: '0123456789abcdef',
          parallelism: 1,
          passes: 1,
          tagLength: DIGEST_BYTES
        })
        break
      case 'scrypt':
        QuickCrypto.scryptSync('probe', '0123456789abcdef', DIGEST_BYTES, {
          N: config.n,
          maxmem: SCRYPT_MAXMEM_BYTES,
          p: config.p,
          r: config.r
        })
        break
      case 'pbkdf2':
        QuickCrypto.pbkdf2Sync('probe', '0123456789abcdef', 1, 1, 'sha256')
        break
      default: {
        const _exhaustive: never = config
        throw new Error(`Unsupported KDF: ${JSON.stringify(_exhaustive)}`)
      }
    }
    available = true
  } catch {
    available = false
  }
  availabilityCache.set(config.name, available)
  return available
}

/** Strongest KDF usable in this environment. */
export function getBestAvailableKdf(): PinKdfConfig {
  for (const config of PREFERENCE_ORDER) {
    if (isKdfAvailable(config)) {
      return config
    }
  }
  // pbkdf2 has shipped in every supported runtime; unreachable in practice.
  return PBKDF2_CONFIG
}

export function serializeKdf(config: PinKdfConfig): string {
  switch (config.name) {
    case 'argon2id':
      return `argon2id:m=${config.memoryKiB},t=${config.passes},p=${config.parallelism}`
    case 'scrypt':
      return `scrypt:N=${config.n},r=${config.r},p=${config.p}`
    case 'pbkdf2':
      return `pbkdf2:i=${config.iterations}`
    default: {
      const _exhaustive: never = config
      throw new Error(`Unsupported KDF: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

export function parseKdf(serialized: string): PinKdfConfig | null {
  const argon2 = serialized.match(/^argon2id:m=(\d+),t=(\d+),p=(\d+)$/)
  if (argon2) {
    return {
      memoryKiB: Number(argon2[1]),
      name: 'argon2id',
      parallelism: Number(argon2[3]),
      passes: Number(argon2[2])
    }
  }
  const scrypt = serialized.match(/^scrypt:N=(\d+),r=(\d+),p=(\d+)$/)
  if (scrypt) {
    return {
      n: Number(scrypt[1]),
      name: 'scrypt',
      p: Number(scrypt[3]),
      r: Number(scrypt[2])
    }
  }
  const pbkdf2 = serialized.match(/^pbkdf2:i=(\d+)$/)
  if (pbkdf2) {
    return { iterations: Number(pbkdf2[1]), name: 'pbkdf2' }
  }
  return null
}

/** Stored KDF config; digests written before configs were tracked are legacy. */
export async function getStoredKdfConfig(
  key: string = PIN_KDF_KEY
): Promise<PinKdfConfig> {
  const stored = await getItem(key)
  if (stored) {
    const parsed = parseKdf(stored)
    if (parsed) {
      return parsed
    }
  }
  return LEGACY_KDF_CONFIG
}

export async function storeKdfConfig(
  config: PinKdfConfig,
  key: string = PIN_KDF_KEY
): Promise<void> {
  await setItem(key, serializeKdf(config))
}

export function kdfConfigsEqual(a: PinKdfConfig, b: PinKdfConfig): boolean {
  return serializeKdf(a) === serializeKdf(b)
}

export function derivePinDigest(
  pin: string,
  salt: string,
  config: PinKdfConfig
): Promise<string> {
  return deriveWithConfig(pin, salt, config)
}

/**
 * Derives new PIN material without writing it. Reuses the existing salt so a
 * PIN change does not invalidate a duress digest bound to the same salt.
 */
export async function preparePinMaterial(pin: string): Promise<PinMaterial> {
  const existingSalt = await getItem(SALT_KEY)
  const salt = existingSalt ?? (await generateSalt())
  const kdf = getBestAvailableKdf()
  const digest = await derivePinDigest(pin, salt, kdf)
  return { digest, kdf, length: pin.length, salt }
}

/** Commits PIN material after secrets have been re-encrypted to `digest`. */
export async function commitPinMaterial(material: PinMaterial): Promise<void> {
  await setItem(SALT_KEY, material.salt)
  await setItem(PIN_KEY, material.digest)
  await storeKdfConfig(material.kdf, PIN_KDF_KEY)
  await setItem(PIN_LENGTH_KEY, String(material.length))
}

/** Timing-safe equality for hex digests of arbitrary length. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verifies a candidate against the stored duress digest. Current installs
 * share SALT_KEY with the main PIN; pre-upgrade duress digests used
 * SALT_KEY_DURESS and the legacy PBKDF2 config.
 */
export async function pinMatchesDuressDigest(
  pin: string,
  storedDuressDigest: string
): Promise<boolean> {
  const duressKdf = await getStoredKdfConfig(DURESS_KDF_KEY)
  const sharedSalt = await getItem(SALT_KEY)
  if (sharedSalt) {
    const digest = await derivePinDigest(pin, sharedSalt, duressKdf)
    if (safeEqualHex(digest, storedDuressDigest)) {
      return true
    }
  }

  const legacySalt = await getItem(SALT_KEY_DURESS)
  if (!legacySalt) {
    return false
  }
  const legacyDigest = await derivePinDigest(pin, legacySalt, LEGACY_KDF_CONFIG)
  return safeEqualHex(legacyDigest, storedDuressDigest)
}

/**
 * Re-derive the stored PIN digest under the current best KDF and re-encrypt
 * all key secrets to it. The duress PIN digest is intentionally untouched:
 * it is a hash of an unknown plaintext, so it keeps verifying under its
 * stored (possibly legacy) config until the user re-sets it.
 *
 * Write order narrows the failure window: secrets are re-encrypted first and
 * the digest/config swap happens last, so an interrupted migration is
 * recoverable on the next unlock (verification still uses the old config).
 * Returns the new digest when a migration ran, or null when already current.
 */
export async function migratePinKdfIfNeeded(
  pin: string,
  salt: string,
  storedDigest: string,
  reEncryptSecrets: (oldDigest: string, newDigest: string) => Promise<void>
): Promise<string | null> {
  const storedConfig = await getStoredKdfConfig()
  const currentConfig = getBestAvailableKdf()
  if (kdfConfigsEqual(storedConfig, currentConfig)) {
    return null
  }

  const oldDigest = await derivePinDigest(pin, salt, storedConfig)
  if (!safeEqualHex(oldDigest, storedDigest)) {
    // The caller verifies the PIN before migrating; this is defense in depth.
    return null
  }

  const newDigest = await derivePinDigest(pin, salt, currentConfig)
  await reEncryptSecrets(oldDigest, newDigest)
  await setItem(PIN_KEY, newDigest)
  await storeKdfConfig(currentConfig)
  return newDigest
}
