import { type ScriptVersionType } from '@/types/models/Script'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import {
  type Bip137AddressType,
  isBip137SignatureFormat,
  signMessageBip137,
  verifyMessageBip137
} from '@/utils/bip137'
import { signMessageBip322, verifyMessageBip322 } from '@/utils/bip322'
import { getScriptTypeFromAddress } from '@/utils/bitcoin'

export type MessageSignMethod = 'bip137' | 'bip322'

export type MessageVerifyResult = {
  valid: boolean
  method: MessageSignMethod | null
}

/**
 * P2PKH is BIP-137 only (no witness, so BIP-322 doesn't apply). P2TR is
 * BIP-322 only (BIP-137 has no Taproot header range). P2WPKH and
 * P2SH-P2WPKH support both, so the caller/UI picks which to sign with.
 */
export function getSupportedSignMethods(
  scriptVersion: ScriptVersionType | undefined
): MessageSignMethod[] {
  if (scriptVersion === 'P2PKH') {
    return ['bip137']
  }
  if (scriptVersion === 'P2WPKH' || scriptVersion === 'P2SH-P2WPKH') {
    return ['bip137', 'bip322']
  }
  if (scriptVersion === 'P2TR') {
    return ['bip322']
  }
  return []
}

export function signAddressMessage(
  privateKey: Buffer,
  address: string,
  message: string,
  scriptVersion: ScriptVersionType | undefined,
  network: AppNetwork,
  method: MessageSignMethod
): string {
  if (!getSupportedSignMethods(scriptVersion).includes(method)) {
    throw new Error(`${method} is not supported for ${scriptVersion}`)
  }
  if (method === 'bip137') {
    let addressType: Bip137AddressType = 'p2pkh'
    if (scriptVersion === 'P2WPKH') {
      addressType = 'p2wpkh'
    } else if (scriptVersion === 'P2SH-P2WPKH') {
      addressType = 'p2sh-p2wpkh'
    }
    return signMessageBip137(privateKey, message, addressType)
  }
  return signMessageBip322(privateKey, address, message, network)
}

export function verifyAddressMessage(
  address: string,
  message: string,
  signatureBase64: string,
  network: AppNetwork
): MessageVerifyResult {
  const scriptType = getScriptTypeFromAddress(address, network)

  if (scriptType === 'p2pkh') {
    return {
      method: 'bip137',
      valid: verifyMessageBip137(address, message, signatureBase64, network)
    }
  }

  if (scriptType === 'p2tr') {
    return {
      method: 'bip322',
      valid: verifyMessageBip322(address, message, signatureBase64, network)
    }
  }

  if (scriptType === 'p2wpkh' || scriptType === 'p2sh') {
    if (isBip137SignatureFormat(signatureBase64)) {
      return {
        method: 'bip137',
        valid: verifyMessageBip137(address, message, signatureBase64, network)
      }
    }
    return {
      method: 'bip322',
      valid: verifyMessageBip322(address, message, signatureBase64, network)
    }
  }

  return { method: null, valid: false }
}
