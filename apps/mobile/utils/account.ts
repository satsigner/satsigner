import { useAuthStore } from '@/store/auth'
import { type Account, type Key } from '@/types/models/Account'
import { aesDecrypt, getPinForDecryption } from '@/utils/crypto'

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
    } catch (_error) {
      // Decryption failed, return empty string
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
