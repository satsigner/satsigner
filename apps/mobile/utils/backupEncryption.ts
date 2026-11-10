import {
  BackupJsonSchema,
  type BackupV1,
  type BackupV2,
  BackupVersionJsonSchema
} from '@/types/models/Backup'
import {
  aesDecrypt,
  aesGcmDecrypt,
  aesGcmEncrypt,
  generateSalt,
  pbkdf2Encrypt
} from '@/utils/crypto'
import {
  derivePinDigest,
  parseKdf,
  PBKDF2_CONFIG,
  type PinKdfConfig,
  SCRYPT_CONFIG,
  serializeKdf
} from '@/utils/pinKdf'

const BACKUP_VERSION = 2

// The backup holds every seed and leaves the device, and the KDF runs once per
// export or restore, so it affords more than the PIN's interactive Argon2id:
// RFC 9106's second recommended option (64 MiB, t=3), with p=1 for phones.
const BACKUP_ARGON2ID_CONFIG: PinKdfConfig = {
  memoryKiB: 65_536,
  name: 'argon2id',
  parallelism: 1,
  passes: 3
}

const BACKUP_KDF_PREFERENCE_ORDER: PinKdfConfig[] = [
  BACKUP_ARGON2ID_CONFIG,
  SCRYPT_CONFIG,
  PBKDF2_CONFIG
]

// The KDF in a backup file is untrusted input: cap it so a crafted file cannot
// make restore allocate or spin without bound.
const MAX_ARGON2ID_MEMORY_KIB = 262_144
const MAX_ARGON2ID_PASSES = 10
const MAX_ARGON2ID_PARALLELISM = 4
const MAX_SCRYPT_N = 65_536
const MAX_SCRYPT_R = 16
const MAX_SCRYPT_P = 4
const MAX_PBKDF2_ITERATIONS = 10_000_000

// Untagged dev builds between v0.2.1 and v0.3.0 wrote v1 ciphertext as hex
// instead of base64. Real base64 ciphertext never matches this pattern.
const LEGACY_HEX_CIPHER_PATTERN = /^(?:[0-9a-f]{32})+$/

type BackupDecryptResult =
  | { plaintext: string; status: 'decrypted' }
  | { status: 'invalid' }
  | { status: 'unsupportedVersion' }
  | { status: 'wrongPassphrase' }

async function deriveBackupKey(
  passphrase: string,
  salt: string
): Promise<{ kdf: PinKdfConfig; key: string }> {
  for (const kdf of BACKUP_KDF_PREFERENCE_ORDER) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- fall back one KDF at a time
      const key = await derivePinDigest(passphrase, salt, kdf)
      return { kdf, key }
    } catch {
      // unavailable on this device: try the next KDF
    }
  }
  throw new Error('No usable backup KDF')
}

function isWithinBackupKdfLimits(kdf: PinKdfConfig): boolean {
  switch (kdf.name) {
    case 'argon2id': {
      return (
        kdf.memoryKiB <= MAX_ARGON2ID_MEMORY_KIB &&
        kdf.passes <= MAX_ARGON2ID_PASSES &&
        kdf.parallelism <= MAX_ARGON2ID_PARALLELISM
      )
    }
    case 'scrypt': {
      return (
        kdf.n <= MAX_SCRYPT_N && kdf.r <= MAX_SCRYPT_R && kdf.p <= MAX_SCRYPT_P
      )
    }
    case 'pbkdf2': {
      return kdf.iterations <= MAX_PBKDF2_ITERATIONS
    }
    default: {
      const _exhaustive: never = kdf
      throw new Error(`Unsupported KDF: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function parseBackupKdf(serialized: string): PinKdfConfig | null {
  const kdf = parseKdf(serialized)
  if (!kdf || !isWithinBackupKdfLimits(kdf)) {
    return null
  }
  return kdf
}

function isNewerBackupVersion(raw: string): boolean {
  const version = BackupVersionJsonSchema.safeParse(raw)
  return version.success && version.data.v > BACKUP_VERSION
}

function toBase64Cipher(cipher: string): string {
  if (!LEGACY_HEX_CIPHER_PATTERN.test(cipher)) {
    return cipher
  }
  return Buffer.from(cipher, 'hex').toString('base64')
}

async function decryptBackupV1(
  backup: BackupV1,
  passphrase: string
): Promise<string> {
  const key = await pbkdf2Encrypt(passphrase, backup.salt)
  return aesDecrypt(toBase64Cipher(backup.cipher), key, backup.iv)
}

async function decryptBackupV2(
  backup: BackupV2,
  kdf: PinKdfConfig,
  passphrase: string
): Promise<string> {
  const key = await derivePinDigest(passphrase, backup.salt, kdf)
  return aesGcmDecrypt(backup, key)
}

async function attemptDecrypt(
  decrypt: () => Promise<string>
): Promise<BackupDecryptResult> {
  try {
    return { plaintext: await decrypt(), status: 'decrypted' }
  } catch {
    return { status: 'wrongPassphrase' }
  }
}

async function encryptBackup(
  plaintext: string,
  passphrase: string
): Promise<string> {
  const salt = await generateSalt()
  const { kdf, key } = await deriveBackupKey(passphrase, salt)
  const { cipher, iv, tag } = aesGcmEncrypt(plaintext, key)
  return BackupJsonSchema.encode({
    cipher,
    iv,
    kdf: serializeKdf(kdf),
    salt,
    tag,
    v: BACKUP_VERSION
  })
}

function decryptBackup(
  raw: string,
  passphrase: string
): Promise<BackupDecryptResult> {
  const parsed = BackupJsonSchema.safeParse(raw)
  if (!parsed.success) {
    return Promise.resolve({
      status: isNewerBackupVersion(raw) ? 'unsupportedVersion' : 'invalid'
    })
  }
  const backup = parsed.data
  if (backup.v === 1) {
    return attemptDecrypt(() => decryptBackupV1(backup, passphrase))
  }
  const kdf = parseBackupKdf(backup.kdf)
  if (!kdf) {
    return Promise.resolve({ status: 'invalid' })
  }
  return attemptDecrypt(() => decryptBackupV2(backup, kdf, passphrase))
}

export { type BackupDecryptResult, decryptBackup, encryptBackup }
