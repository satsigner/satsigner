import { type Account, type Key } from '@/types/models/Account'

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
