import { type Key } from '@/types/models/Account'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'

export function isSeedDropped(
  keyDetails: Key | null,
  decryptedKey?: Key
): boolean {
  if (!keyDetails) {
    return false
  }
  if (decryptedKey && typeof decryptedKey.secret === 'object') {
    return !decryptedKey.secret.mnemonic
  }
  if (typeof keyDetails.secret === 'object') {
    return !keyDetails.secret.mnemonic
  }
  return false
}

function extractPublicKeyFromObjectSecret(secret: {
  extendedPublicKey?: string
  externalDescriptor?: string
}): string {
  if (secret.extendedPublicKey) {
    return secret.extendedPublicKey
  }
  if (secret.externalDescriptor) {
    try {
      return getExtendedKeyFromDescriptor(secret.externalDescriptor)
    } catch {
      return ''
    }
  }
  return ''
}

export function hasMultisigDuplicateXpubs(
  keys: (Key | undefined | null)[]
): boolean {
  const xpubs = keys
    .filter((key): key is Key => Boolean(key))
    .map((key) => {
      if (typeof key.secret !== 'object') return ''
      if (key.secret.extendedPublicKey) {
        return (
          getExtendedKeyFromDescriptor(key.secret.extendedPublicKey) ||
          key.secret.extendedPublicKey
        )
      }
      if (key.secret.externalDescriptor) {
        return getExtendedKeyFromDescriptor(key.secret.externalDescriptor)
      }
      return ''
    })
    .filter(Boolean)

  return new Set(xpubs).size !== xpubs.length
}

export function extractPublicKeyFromKey(
  keyDetails: Key | null,
  decryptedKey?: Key
): string {
  if (!keyDetails) {
    return ''
  }

  if (typeof keyDetails.secret === 'string') {
    if (decryptedKey && typeof decryptedKey.secret === 'object') {
      return extractPublicKeyFromObjectSecret(decryptedKey.secret)
    }
    return ''
  }

  if (typeof keyDetails.secret === 'object') {
    return extractPublicKeyFromObjectSecret(keyDetails.secret)
  }

  return ''
}
