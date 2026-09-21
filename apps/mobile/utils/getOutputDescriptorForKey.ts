import { KeychainKind } from 'react-native-bdk-sdk'

import { getExtendedPublicKeyFromAccountKey } from '@/api/bdk'
import type { Account, DecryptedKey, Key, Secret } from '@/types/models/Account'
import type { ScriptVersionType } from '@/types/models/Script'
import type { Network as AppNetwork } from '@/types/settings/blockchain'
import {
  getDescriptorsFromKey,
  getExtendedKeyFromDescriptor,
  getFingerprintFromExtendedPublicKey
} from '@/utils/bip32'
import { getPublicDescriptorFromMnemonic } from '@/utils/bip39'
import {
  appNetworkToBdkNetwork,
  getDerivationPathFromScriptVersion
} from '@/utils/bitcoin'

function singlesigDescriptorFromKeyPart(
  keyPart: string,
  scriptVersion: ScriptVersionType | undefined
): string {
  switch (scriptVersion) {
    case 'P2PKH':
      return `pkh(${keyPart})`
    case 'P2SH-P2WPKH':
      return `sh(wpkh(${keyPart}))`
    case 'P2WPKH':
      return `wpkh(${keyPart})`
    case 'P2TR':
      return `tr(${keyPart})`
    case 'P2WSH':
      return `wsh(${keyPart})`
    case 'P2SH-P2WSH':
      return `sh(wsh(${keyPart}))`
    case 'P2SH':
      return `sh(${keyPart})`
    default:
      return `wpkh(${keyPart})`
  }
}

type WalletDescriptorSlice = {
  externalDescriptor?: string
}

type NostrDescriptorAccountSlice = Pick<Account, 'network' | 'policyType'>

/**
 * Descriptor string for Nostr shared keys: matches Export Descriptor for
 * singlesig/watchonly, and the full policy descriptor for multisig.
 */
export async function resolveDescriptorForNostrCommonKeys(
  account: NostrDescriptorAccountSlice,
  firstKey: Key,
  secret: Secret,
  walletData: WalletDescriptorSlice | undefined
): Promise<string> {
  const fromWallet = walletData?.externalDescriptor?.trim() || ''
  const fromSecret = secret.externalDescriptor?.trim() || ''

  if (account.policyType === 'multisig') {
    return fromWallet || fromSecret
  }

  return (
    (await getOutputDescriptorStringForKey(
      firstKey,
      secret,
      account.network
    )) ||
    fromWallet ||
    fromSecret
  )
}

/** Public output descriptor shown on Export Descriptor (QR / copy). */
export async function getOutputDescriptorStringForKey(
  key: Key,
  secret: Secret,
  appNetwork: AppNetwork
): Promise<string> {
  const bdkNetwork = appNetworkToBdkNetwork(appNetwork)

  if (
    key.creationType === 'generateMnemonic' ||
    key.creationType === 'importMnemonic'
  ) {
    const stored = secret.externalDescriptor?.trim()
    if (stored) {
      return stored
    }
    if (secret.mnemonic && key.scriptVersion) {
      return await getPublicDescriptorFromMnemonic(
        secret.mnemonic,
        key.scriptVersion,
        KeychainKind.External,
        secret.passphrase,
        bdkNetwork
      )
    }
    return ''
  }

  if (key.creationType === 'importDescriptor') {
    const stored = secret.externalDescriptor?.trim() || ''
    if (stored || !secret.extendedPublicKey) {
      return stored
    }
    const fingerprint = secret.fingerprint || ''
    const derivationPath = getDerivationPathFromScriptVersion(
      key.scriptVersion || 'P2WPKH',
      appNetwork
    )
    const keyPart =
      fingerprint && derivationPath
        ? `[${fingerprint}/${derivationPath}]${secret.extendedPublicKey}/0/*`
        : `${secret.extendedPublicKey}/0/*`
    return singlesigDescriptorFromKeyPart(keyPart, key.scriptVersion)
  }

  if (key.creationType === 'importExtendedPub' && secret.extendedPublicKey) {
    const fingerprint = secret.fingerprint || ''
    if (fingerprint) {
      try {
        const descriptors = getDescriptorsFromKey(
          secret.extendedPublicKey,
          fingerprint,
          key.scriptVersion || 'P2WPKH',
          bdkNetwork
        )
        return descriptors.externalDescriptor
      } catch {
        // Fall through to manual construction (same as Export Descriptor).
      }
    }
    const derivationPath = getDerivationPathFromScriptVersion(
      key.scriptVersion || 'P2WPKH',
      appNetwork
    )
    const keyPart = fingerprint
      ? `[${fingerprint}/${derivationPath}]${secret.extendedPublicKey}/0/*`
      : `${secret.extendedPublicKey}/0/*`
    return singlesigDescriptorFromKeyPart(keyPart, key.scriptVersion)
  }

  return ''
}

export type KeyMaterial = {
  extendedPublicKey: string
  fingerprint: string
}

async function resolveExtendedPublicKey(
  key: DecryptedKey,
  secret: Secret,
  appNetwork: AppNetwork
): Promise<string> {
  if (typeof secret !== 'object') {
    return ''
  }
  if (secret.extendedPublicKey) {
    return secret.extendedPublicKey
  }
  if (secret.externalDescriptor) {
    return getExtendedKeyFromDescriptor(secret.externalDescriptor)
  }
  if (!secret.mnemonic) {
    return ''
  }
  try {
    const extendedKey = await getExtendedPublicKeyFromAccountKey(
      {
        ...key,
        secret: { mnemonic: secret.mnemonic, passphrase: secret.passphrase }
      },
      appNetworkToBdkNetwork(appNetwork)
    )
    return extendedKey || ''
  } catch {
    return ''
  }
}

function fingerprintFromExtendedPublicKey(extendedPublicKey: string): string {
  if (!extendedPublicKey) {
    return ''
  }
  try {
    return getFingerprintFromExtendedPublicKey(extendedPublicKey)
  } catch {
    return ''
  }
}

/**
 * Fingerprint and extended public key for a decrypted account key, trying each
 * source the key may carry. Shared by the singlesig and multisig branches of
 * Export Descriptors; returns empty strings for whatever cannot be resolved.
 */
export async function resolveKeyMaterial(
  key: DecryptedKey,
  secret: Secret,
  appNetwork: AppNetwork
): Promise<KeyMaterial> {
  const extendedPublicKey = await resolveExtendedPublicKey(
    key,
    secret,
    appNetwork
  )

  const fingerprint =
    (typeof secret === 'object' && secret.fingerprint) ||
    key.fingerprint ||
    fingerprintFromExtendedPublicKey(extendedPublicKey)

  return { extendedPublicKey, fingerprint }
}
