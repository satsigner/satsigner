import { useAuthStore } from '@/store/auth'
import { type Account, type Key } from '@/types/models/Account'
import { aesDecrypt, getPinForDecryption } from '@/utils/crypto'

const MAX_DAYS_WITHOUT_SYNCING = 3

/**
 * Extract the fingerprint from an account's first key
 * This function handles both encrypted and decrypted secrets
 * @param account The account to extract the fingerprint from
 * @param decryptedKeys Optional array of decrypted keys (if already available)
 * @returns The fingerprint string or empty string if not found
 */
export function extractAccountFingerprint(
  account: Account,
  decryptedKeys?: Key[]
): string {
  if (!account?.keys?.length) {
    return ''
  }

  const firstKey = account.keys[0]

  // First, try to get fingerprint from decrypted keys if available
  if (decryptedKeys && decryptedKeys.length > 0) {
    const decryptedKey = decryptedKeys[0]
    if (decryptedKey) {
      // Check if the decrypted secret has a fingerprint
      if (
        typeof decryptedKey.secret === 'object' &&
        decryptedKey.secret.fingerprint
      ) {
        return decryptedKey.secret.fingerprint
      }
      // Check if the decrypted key has a fingerprint
      if (decryptedKey.fingerprint) {
        return decryptedKey.fingerprint
      }
    }
  }

  // Fallback to account keys
  // Check if the secret is already decrypted and has a fingerprint
  if (typeof firstKey.secret === 'object' && firstKey.secret.fingerprint) {
    return firstKey.secret.fingerprint
  }

  // Check if the key has a fingerprint
  if (firstKey.fingerprint) {
    return firstKey.fingerprint
  }

  return ''
}

/**
 * Extract the fingerprint from an account's first key with decryption support
 * This function can decrypt the account data if needed and supports skipPin scenarios
 * @param account The account to extract the fingerprint from
 * @returns Promise that resolves to the fingerprint string or empty string if not found
 */
export async function extractAccountFingerprintWithDecryption(
  account: Account
): Promise<string> {
  if (!account?.keys?.length) {
    return ''
  }

  const firstKey = account.keys[0]

  // First, check if fingerprint is available at key level (no decryption needed)
  if (firstKey.fingerprint) {
    return firstKey.fingerprint
  }

  // Check if the secret is already decrypted and has a fingerprint
  if (typeof firstKey.secret === 'object' && firstKey.secret.fingerprint) {
    return firstKey.secret.fingerprint
  }

  // If secret is encrypted and we need to decrypt it
  if (typeof firstKey.secret === 'string') {
    try {
      const skipPin = useAuthStore.getState().skipPin
      const pin = await getPinForDecryption(skipPin)
      if (!pin) {
        return ''
      }

      const decryptedSecretString = await aesDecrypt(
        firstKey.secret,
        pin,
        firstKey.iv
      )
      const decryptedSecret = JSON.parse(decryptedSecretString)

      if (decryptedSecret.fingerprint) {
        return decryptedSecret.fingerprint
      }
    } catch {
      // Decryption failed
      return ''
    }
  }

  return ''
}

/**
 * Extract the fingerprint from a specific key
 * This function handles both encrypted and decrypted secrets
 * @param key The key to extract the fingerprint from
 * @param decryptedKey Optional decrypted key (if already available)
 * @returns The fingerprint string or empty string if not found
 */
export function extractKeyFingerprint(key: Key, decryptedKey?: Key): string {
  // First, try to get fingerprint from decrypted key if available
  if (decryptedKey) {
    // Check if the decrypted secret has a fingerprint
    if (
      typeof decryptedKey.secret === 'object' &&
      decryptedKey.secret.fingerprint
    ) {
      return decryptedKey.secret.fingerprint
    }
    // Check if the decrypted key has a fingerprint
    if (decryptedKey.fingerprint) {
      return decryptedKey.fingerprint
    }
  }

  // Fallback to original key
  // Check if the secret is already decrypted and has a fingerprint
  if (typeof key.secret === 'object' && key.secret.fingerprint) {
    return key.secret.fingerprint
  }

  // Check if the key has a fingerprint
  if (key.fingerprint) {
    return key.fingerprint
  }

  return ''
}

/**
 * Check if a wallet needs syncing based on the time since last sync
 * @param account The account to check
 * @param maxDaysWithoutSyncing Maximum days without syncing (default: 3)
 * @returns true if the wallet needs syncing, false otherwise
 */
export function checkWalletNeedsSync(
  account: Account,
  maxDaysWithoutSyncing: number = MAX_DAYS_WITHOUT_SYNCING
): boolean {
  // If no lastSyncedAt, definitely needs sync
  if (account.lastSyncedAt === undefined) {
    return true
  }

  // Safely convert lastSyncedAt to Date object
  let lastSync: Date
  try {
    const lastSyncedAtValue = account.lastSyncedAt

    // If it's already a Date object, use it
    if (lastSyncedAtValue instanceof Date) {
      lastSync = lastSyncedAtValue
    } else {
      // If it's a string or number, try to create a Date
      lastSync = new Date(lastSyncedAtValue)

      // Check if the date is valid
      if (isNaN(lastSync.getTime())) {
        // Invalid lastSyncedAt value, needs sync
        return true
      }
    }
  } catch {
    // Error parsing lastSyncedAt, needs sync
    return true
  }

  const now = new Date()

  // Discard the time and time-zone information.
  const currentUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())

  const lastSyncedUtc = Date.UTC(
    lastSync.getFullYear(),
    lastSync.getMonth(),
    lastSync.getDate()
  )

  const MILISECONDS_PER_DAY = 1000 * 60 * 60 * 24
  const daysSinceLastSync = Math.floor(
    (currentUtc - lastSyncedUtc) / MILISECONDS_PER_DAY
  )

  // Account updated too long ago.
  return daysSinceLastSync > maxDaysWithoutSyncing
}
