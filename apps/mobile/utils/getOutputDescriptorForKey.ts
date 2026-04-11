import { KeychainKind } from 'react-native-bdk-sdk'

import type {
  Account,
  Key,
  ScriptVersionType,
  Secret
} from '@/types/models/Account'
import type { Network as AppNetwork } from '@/types/settings/blockchain'
import { getDescriptorsFromKey } from '@/utils/bip32'
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
export function resolveDescriptorForNostrCommonKeys(
  account: NostrDescriptorAccountSlice,
  firstKey: Key,
  secret: Secret,
  walletData: WalletDescriptorSlice | undefined
): string {
  const fromWallet = walletData?.externalDescriptor?.trim() || ''
  const fromSecret = secret.externalDescriptor?.trim() || ''

  if (account.policyType === 'multisig') {
    return fromWallet || fromSecret
  }

  return (
    getOutputDescriptorStringForKey(firstKey, secret, account.network) ||
    fromWallet ||
    fromSecret
  )
}

/** Public output descriptor shown on Export Descriptor (QR / copy). */
export function getOutputDescriptorStringForKey(
  key: Key,
  secret: Secret,
  appNetwork: AppNetwork
): string {
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
      return getPublicDescriptorFromMnemonic(
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
    let descriptorString = secret.externalDescriptor?.trim() || ''
    if (!descriptorString && secret.extendedPublicKey) {
      const fingerprint = secret.fingerprint || ''
      const derivationPath = getDerivationPathFromScriptVersion(
        key.scriptVersion || 'P2WPKH',
        appNetwork
      )
      const keyPart =
        fingerprint && derivationPath
          ? `[${fingerprint}/${derivationPath}]${secret.extendedPublicKey}/0/*`
          : `${secret.extendedPublicKey}/0/*`
      descriptorString = singlesigDescriptorFromKeyPart(
        keyPart,
        key.scriptVersion
      )
    }
    return descriptorString
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
