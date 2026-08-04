import QuickCrypto from 'react-native-quick-crypto'

import { PIN_KDF_KEY, PIN_KEY } from '@/config/auth'
import { getItem, setItem } from '@/storage/encrypted'

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

function deriveWithConfig(
  pin: string,
  salt: string,
  config: PinKdfConfig
): string {
  switch (config.name) {
    case 'argon2id': {
      const derived = QuickCrypto.argon2Sync('argon2id', {
        memory: config.memoryKiB,
        message: pin,
        nonce: salt,
        parallelism: config.parallelism,
        passes: config.passes,
        tagLength: DIGEST_BYTES
      })
      return Buffer.from(derived).toString('hex')
    }
    case 'scrypt': {
      const derived = QuickCrypto.scryptSync(pin, salt, DIGEST_BYTES, {
        N: config.n,
        p: config.p,
        r: config.r
      })
      return Buffer.from(derived).toString('hex')
    }
    case 'pbkdf2': {
      const derived = QuickCrypto.pbkdf2Sync(
        pin,
        salt,
        config.iterations,
        DIGEST_BYTES,
        'sha256'
      )
      return Buffer.from(derived).toString('hex')
    }
    default: {
      throw new Error(`Unsupported KDF: ${(config as PinKdfConfig).name}`)
    }
  }
}

const availabilityCache = new Map<string, boolean>()

// Probes with the cheapest legal parameters; native modules that are missing
// or too constrained throw, and we fall through to the next candidate.
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
          N: 2,
          p: 1,
          r: 1
        })
        break
      case 'pbkdf2':
        QuickCrypto.pbkdf2Sync('probe', '0123456789abcdef', 1, 1, 'sha256')
        break
      default:
        throw new Error(`Unsupported KDF: ${(config as PinKdfConfig).name}`)
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
    default:
      throw new Error(`Unsupported KDF: ${(config as PinKdfConfig).name}`)
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
  return Promise.resolve(deriveWithConfig(pin, salt, config))
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
