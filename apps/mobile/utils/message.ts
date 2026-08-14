import { type ScriptVersionType } from '@/types/models/Script'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import {
  type Bip137AddressType,
  signMessageBip137,
  verifyMessageBip137
} from '@/utils/bip137'
import {
  signMessageBip322Taproot,
  verifyMessageBip322Taproot
} from '@/utils/bip322'
import { getScriptTypeFromAddress } from '@/utils/bitcoin'

export type MessageSignMethod = 'bip137' | 'bip322'

export type MessageVerifyResult = {
  valid: boolean
  method: MessageSignMethod | null
}

/**
 * BIP-137 covers legacy/segwit-v0 single-sig addresses; BIP-322 is only
 * implemented here for Taproot key-path spends, since BIP-137 has no
 * Taproot header range.
 */
export function getSupportedSignMethod(
  scriptVersion: ScriptVersionType | undefined
): MessageSignMethod | null {
  if (
    scriptVersion === 'P2PKH' ||
    scriptVersion === 'P2WPKH' ||
    scriptVersion === 'P2SH-P2WPKH'
  ) {
    return 'bip137'
  }
  if (scriptVersion === 'P2TR') {
    return 'bip322'
  }
  return null
}

export function signAddressMessage(
  privateKey: Buffer,
  address: string,
  message: string,
  scriptVersion: ScriptVersionType | undefined,
  network: AppNetwork
): string {
  const method = getSupportedSignMethod(scriptVersion)
  if (method === 'bip137') {
    let addressType: Bip137AddressType = 'p2pkh'
    if (scriptVersion === 'P2WPKH') {
      addressType = 'p2wpkh'
    } else if (scriptVersion === 'P2SH-P2WPKH') {
      addressType = 'p2sh-p2wpkh'
    }
    return signMessageBip137(privateKey, message, addressType)
  }
  if (method === 'bip322') {
    return signMessageBip322Taproot(privateKey, address, message, network)
  }
  throw new Error(`Message signing is not supported for ${scriptVersion}`)
}

export function verifyAddressMessage(
  address: string,
  message: string,
  signatureBase64: string,
  network: AppNetwork
): MessageVerifyResult {
  const scriptType = getScriptTypeFromAddress(address, network)
  if (scriptType === 'p2tr') {
    return {
      method: 'bip322',
      valid: verifyMessageBip322Taproot(
        address,
        message,
        signatureBase64,
        network
      )
    }
  }
  if (
    scriptType === 'p2pkh' ||
    scriptType === 'p2wpkh' ||
    scriptType === 'p2sh'
  ) {
    return {
      method: 'bip137',
      valid: verifyMessageBip137(address, message, signatureBase64, network)
    }
  }
  return { method: null, valid: false }
}
