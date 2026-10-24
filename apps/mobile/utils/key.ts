import { KeychainKind, type Network as BDKNetwork } from 'react-native-bdk-sdk'

import {
  type Account,
  type DecryptedKey,
  type Key,
  type Secret
} from '@/types/models/Account'
import { type Address, type AddressKeyPair } from '@/types/models/Address'
import {
  getAddressKeyPairFromExtendedKey,
  getAddressKeyPairFromSeed,
  getExtendedKeyFromDescriptor,
  getExtendedPrivateKeyFromDescriptor
} from '@/utils/bip32'
import {
  detectElectrumSeed,
  getExtendedPublicKeyFromMnemonicCustom,
  getPublicDescriptorFromMnemonic,
  mnemonicToSeed
} from '@/utils/bip39'
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

/**
 * Whether a key holds an encrypted (string) secret. A reset key slot keeps an
 * empty string, which does not count, so the slot can be filled again.
 */
export function hasEncryptedSecret(key: Key | undefined): boolean {
  return typeof key?.secret === 'string' && key.secret !== ''
}

/**
 * Extended public key of a decrypted key. Seed keys may only store a private
 * descriptor, so the key is derived from the mnemonic then.
 */
export async function getKeyExtendedPublicKey(
  key: DecryptedKey,
  network: BDKNetwork
) {
  const { extendedPublicKey, mnemonic, passphrase } = key.secret
  if (extendedPublicKey || !mnemonic || !key.scriptVersion) {
    return extractPublicKeyFromObjectSecret(key.secret)
  }
  if (key.derivationPath) {
    return getExtendedPublicKeyFromMnemonicCustom(
      mnemonic,
      passphrase ?? '',
      network,
      key.scriptVersion,
      toMasterDerivationPath(key.derivationPath)
    )
  }
  const descriptor = await getPublicDescriptorFromMnemonic(
    mnemonic,
    key.scriptVersion,
    KeychainKind.External,
    passphrase,
    network
  )
  return getExtendedKeyFromDescriptor(descriptor)
}

function toMasterDerivationPath(path: string) {
  if (path === 'm' || path.startsWith('m/')) {
    return path
  }
  return `m/${path.replace(/^\//, '')}`
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
      // Electrum seeds use a different derivation scheme (mnemonicToSeedElectrum)
      // than BIP39 mnemonics; deriving them here would silently produce the
      // wrong key instead of the address's actual one.
      if (detectElectrumSeed(secret.mnemonic)) {
        return null
      }
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
