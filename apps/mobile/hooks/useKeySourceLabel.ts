import { useMemo } from 'react'

import { t } from '@/locales'
import {
  type Key,
  type ScriptVersionType,
  type Secret
} from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { getKeyFormatForScriptVersion } from '@/utils/bitcoin'

type UseKeySourceLabelParams = {
  keyDetails: Key | undefined
  scriptVersion: ScriptVersionType
  network: Network
  seedDropped: boolean
  decryptedKey?: Key
}

type UseKeySourceLabelReturn = {
  sourceLabel: string
  importExtendedLabel: string
  dropSeedLabel: string
  shareXpubLabel: string
}

/**
 * Custom hook for generating consistent key source labels across components
 * Consolidates label generation logic that was duplicated in SSMultisigKeyControl and SSSignatureDropdown
 */
export function useKeySourceLabel({
  keyDetails,
  scriptVersion,
  network,
  seedDropped,
  decryptedKey
}: UseKeySourceLabelParams): UseKeySourceLabelReturn {
  const sourceLabel = useMemo(() => {
    if (!keyDetails) {
      return t('account.selectKeySource')
    }

    if (keyDetails.creationType === 'generateMnemonic') {
      // Check if seed has been dropped
      const hasSeed =
        !seedDropped &&
        ((decryptedKey?.secret &&
          typeof decryptedKey.secret === 'object' &&
          decryptedKey.secret.mnemonic) ||
          (typeof keyDetails.secret === 'object' && keyDetails.secret.mnemonic))

      if (!hasSeed) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.newSeed', {
        name: keyDetails.scriptVersion
      })
    }

    if (keyDetails.creationType === 'importMnemonic') {
      // Check if seed has been dropped
      const hasSeed =
        !seedDropped &&
        ((decryptedKey?.secret &&
          typeof decryptedKey.secret === 'object' &&
          decryptedKey.secret.mnemonic) ||
          (typeof keyDetails.secret === 'object' && keyDetails.secret.mnemonic))

      if (!hasSeed) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.importedSeed', {
        name: keyDetails.scriptVersion
      })
    }

    if (keyDetails.creationType === 'importDescriptor') {
      return t('account.seed.external')
    }

    if (keyDetails.creationType === 'importExtendedPub') {
      // Show the correct label according to the script version and network
      const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
      return t(`account.import.${keyFormat}`)
    }

    return t('account.selectKeySource')
  }, [keyDetails, scriptVersion, network, seedDropped, decryptedKey])

  const importExtendedLabel = useMemo(() => {
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(`account.import.${keyFormat}`)
  }, [scriptVersion, network])

  const dropSeedLabel = useMemo(() => {
    // For multisig, generate dynamic labels based on script type and network
    if (scriptVersion === 'P2SH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.xpub')
        : t('account.seed.dropAndKeep.tpub')
    }

    if (scriptVersion === 'P2SH-P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.ypub')
        : t('account.seed.dropAndKeep.upub')
    }

    if (scriptVersion === 'P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.zpub')
        : t('account.seed.dropAndKeep.vpub')
    }

    if (scriptVersion === 'P2PKH') {
      // P2PKH: Only xpub/tpub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.xpub')
        : t('account.seed.dropAndKeep.tpub')
    }

    if (scriptVersion === 'P2SH-P2WPKH') {
      // P2SH-P2WPKH: xpub/ypub or tpub/upub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.ypub')
        : t('account.seed.dropAndKeep.upub')
    }

    if (scriptVersion === 'P2WPKH') {
      // P2WPKH: xpub/zpub or tpub/vpub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.zpub')
        : t('account.seed.dropAndKeep.vpub')
    }

    if (scriptVersion === 'P2TR') {
      // P2TR: Only vpub (same for all networks)
      return t('account.seed.dropAndKeep.vpub')
    }

    // Fallback for other script types
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(`account.seed.dropAndKeep.${keyFormat}`)
  }, [scriptVersion, network])

  const shareXpubLabel = useMemo(() => {
    // For multisig, generate dynamic labels based on script type and network
    if (scriptVersion === 'P2SH') {
      return network === 'bitcoin'
        ? t('account.seed.shareXpub')
        : t('account.seed.shareTpub')
    }

    if (scriptVersion === 'P2SH-P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.shareYpub')
        : t('account.seed.shareUpub')
    }

    if (scriptVersion === 'P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.shareZpub')
        : t('account.seed.shareVpub')
    }

    if (scriptVersion === 'P2PKH') {
      // P2PKH: Only xpub/tpub
      return network === 'bitcoin'
        ? t('account.seed.shareXpub')
        : t('account.seed.shareTpub')
    }

    if (scriptVersion === 'P2SH-P2WPKH') {
      // P2SH-P2WPKH: xpub/ypub or tpub/upub
      return network === 'bitcoin'
        ? t('account.seed.shareYpub')
        : t('account.seed.shareUpub')
    }

    if (scriptVersion === 'P2WPKH') {
      // P2WPKH: xpub/zpub or tpub/vpub
      return network === 'bitcoin'
        ? t('account.seed.shareZpub')
        : t('account.seed.shareVpub')
    }

    if (scriptVersion === 'P2TR') {
      // P2TR: Only vpub
      return t('account.seed.shareVpub')
    }

    // Fallback for other script types
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(
      `account.seed.share${
        keyFormat.charAt(0).toUpperCase() + keyFormat.slice(1)
      }`
    )
  }, [scriptVersion, network])

  return {
    sourceLabel,
    importExtendedLabel,
    dropSeedLabel,
    shareXpubLabel
  }
}
