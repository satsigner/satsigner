import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Address, type AddressKeyPair } from '@/types/models/Address'
import {
  getAddressKeyPairFromExtendedKey,
  getAddressKeyPairFromSeed,
  getExtendedKeyFromDescriptor,
  getExtendedPrivateKeyFromDescriptor
} from '@/utils/bip32'
import { mnemonicToSeed } from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'

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
    .filter((key): key is Key => key !== null && key !== undefined)
    .map((key) => {
      if (typeof key.secret !== 'object') {
        return ''
      }
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

export function getAddressKeyPair(
  secret: Secret,
  address: Pick<Address, 'derivationPath' | 'index' | 'keychain'>,
  network: Account['network']
): AddressKeyPair | null {
  if (
    !address.derivationPath ||
    address.index === undefined ||
    !address.keychain
  ) {
    return null
  }

  try {
    if (secret.mnemonic) {
      const seed = mnemonicToSeed(secret.mnemonic, secret.passphrase)
      return getAddressKeyPairFromSeed(seed, address.derivationPath)
    }

    const descriptor = secret.externalDescriptor || secret.internalDescriptor
    const extendedPrivateKey = descriptor
      ? getExtendedPrivateKeyFromDescriptor(descriptor)
      : ''

    if (!extendedPrivateKey) {
      return null
    }

    const change = address.keychain === 'internal' ? 1 : 0
    return getAddressKeyPairFromExtendedKey(
      extendedPrivateKey,
      appNetworkToBdkNetwork(network),
      `${change}/${address.index}`
    )
  } catch {
    return null
  }
}
