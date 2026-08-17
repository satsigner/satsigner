import ecc from '@bitcoinerlab/secp256k1'
import {
  address as bjsAddress,
  crypto as bcrypto,
  initEccLib,
  payments
} from 'bitcoinjs-lib'
import * as varuint from 'varuint-bitcoin'

import { type Network as AppNetwork } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { isLowR, lowRExtraEntropy } from '@/utils/ecdsaLowR'

initEccLib(ecc)

const MESSAGE_MAGIC_PREFIX = Buffer.from(
  '\x18Bitcoin Signed Message:\n',
  'utf8'
)

export type Bip137AddressType = 'p2pkh' | 'p2sh-p2wpkh' | 'p2wpkh'

const HEADER_OFFSET: Record<Bip137AddressType, number> = {
  p2pkh: 31,
  'p2sh-p2wpkh': 35,
  p2wpkh: 39
}

function magicHash(message: string): Buffer {
  const messageBuffer = Buffer.from(message, 'utf8')
  const lengthPrefix = varuint.encode(messageBuffer.length)
  return bcrypto.hash256(
    Buffer.concat([MESSAGE_MAGIC_PREFIX, lengthPrefix, messageBuffer])
  )
}

/**
 * BIP-137 signatures are always exactly 65 bytes with a header byte in the
 * 27-42 range. P2WPKH/P2SH-P2WPKH addresses can be signed with either
 * BIP-137 or BIP-322, so this shape check is how a verifier distinguishes
 * them from a BIP-322 witness-stack signature (which is never 65 bytes for
 * a single-key spend: 1-byte count + 1-byte length + a 64/DER-encoded sig).
 */
export function isBip137SignatureFormat(signatureBase64: string): boolean {
  try {
    const signatureBuffer = Buffer.from(signatureBase64, 'base64')
    if (signatureBuffer.length !== 65) {
      return false
    }
    const flag = signatureBuffer[0] - 27
    return flag >= 0 && flag <= 15
  } catch {
    return false
  }
}

/**
 * Signs with RFC6979, grinding for a "low-R" signature (retrying with
 * incrementing extra entropy until found) so the signature stays a
 * consistent, compact size - matching Bitcoin Core, LND, and bitcoinjs-lib.
 */
function signRecoverableLowR(hash: Buffer, privateKey: Buffer) {
  let result = ecc.signRecoverable(hash, privateKey)
  let counter = 0
  while (!isLowR(result.signature)) {
    counter += 1
    result = ecc.signRecoverable(hash, privateKey, lowRExtraEntropy(counter))
  }
  return result
}

/** Sign a message per BIP-137, for a compressed-key single-sig address. */
export function signMessageBip137(
  privateKey: Buffer,
  message: string,
  addressType: Bip137AddressType
): string {
  const hash = magicHash(message)
  const { signature, recoveryId } = signRecoverableLowR(hash, privateKey)
  const header = HEADER_OFFSET[addressType] + recoveryId
  return Buffer.concat([
    Buffer.from([header]),
    Buffer.from(signature)
  ]).toString('base64')
}

export function verifyMessageBip137(
  address: string,
  message: string,
  signatureBase64: string,
  network: AppNetwork
): boolean {
  try {
    const signatureBuffer = Buffer.from(signatureBase64, 'base64')
    if (signatureBuffer.length !== 65) {
      return false
    }

    const flag = signatureBuffer[0] - 27
    if (flag < 0 || flag > 15) {
      return false
    }

    const recoveryId = (flag & 3) as 0 | 1 | 2 | 3
    const compressed = Boolean(flag & 12)
    const isSegwit = Boolean(flag & 8)
    const isP2sh = isSegwit && !(flag & 4)
    const sig = signatureBuffer.subarray(1)

    const pubkey = ecc.recover(magicHash(message), sig, recoveryId, compressed)
    if (!pubkey) {
      return false
    }
    const pubkeyBuffer = Buffer.from(pubkey)

    let candidateScript: Buffer | undefined
    if (isP2sh) {
      candidateScript = payments.p2sh({
        redeem: payments.p2wpkh({ pubkey: pubkeyBuffer })
      }).output
    } else if (isSegwit) {
      candidateScript = payments.p2wpkh({ pubkey: pubkeyBuffer }).output
    } else {
      candidateScript = payments.p2pkh({ pubkey: pubkeyBuffer }).output
    }
    if (!candidateScript) {
      return false
    }

    const targetScript = bjsAddress.toOutputScript(
      address,
      bitcoinjsNetwork(network)
    )
    return candidateScript.equals(targetScript)
  } catch {
    return false
  }
}
