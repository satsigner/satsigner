import ecc from '@bitcoinerlab/secp256k1'
import {
  address as bjsAddress,
  crypto as bcrypto,
  initEccLib,
  opcodes,
  script as bscript,
  Transaction
} from 'bitcoinjs-lib'
import * as varuint from 'varuint-bitcoin'

import { type Network as AppNetwork } from '@/types/settings/blockchain'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

initEccLib(ecc)

const BIP322_TAG = Buffer.from('BIP0322-signed-message', 'utf8')
const TAP_TWEAK_TAG = Buffer.from('TapTweak', 'utf8')
const ZERO_HASH = Buffer.alloc(32, 0)
const SCHNORR_SIGNATURE_LENGTH = 64
// Known BIP-322 variant text prefixes some newer signers/verifiers prepend
// before the base64 payload. satsigner signs without a prefix (matching the
// current real-world wallet ecosystem) but tolerates them on verify.
const KNOWN_VARIANT_PREFIXES = ['smp', 'ful']

function taggedHash(tag: Buffer, data: Buffer): Buffer {
  const tagHash = bcrypto.sha256(tag)
  return bcrypto.sha256(Buffer.concat([tagHash, tagHash, data]))
}

/** Exported for testing against the official BIP-322 test vectors. */
export function bip322MessageHash(message: string): Buffer {
  return taggedHash(BIP322_TAG, Buffer.from(message, 'utf8'))
}

/** Exported for testing against the official BIP-322 test vectors. */
export function buildToSpendTx(
  scriptPubKey: Buffer,
  message: string
): Transaction {
  const tx = new Transaction()
  tx.version = 0
  tx.locktime = 0
  const scriptSig = bscript.compile([opcodes.OP_0, bip322MessageHash(message)])
  tx.addInput(ZERO_HASH, 0xffffffff, 0, scriptSig)
  tx.addOutput(scriptPubKey, 0)
  return tx
}

function buildToSignSighash(
  toSpendTx: Transaction,
  scriptPubKey: Buffer
): Buffer {
  const toSignTx = new Transaction()
  toSignTx.version = 0
  toSignTx.locktime = 0
  toSignTx.addInput(toSpendTx.getHash(), 0, 0)
  toSignTx.addOutput(bscript.compile([opcodes.OP_RETURN]), 0)
  return toSignTx.hashForWitnessV1(
    0,
    [scriptPubKey],
    [0],
    Transaction.SIGHASH_DEFAULT
  )
}

/** BIP-341 private-key tweak for a key-path-only (script-tree-less) output. */
function tweakPrivateKey(privateKey: Buffer): Buffer {
  const pubkey = ecc.pointFromScalar(privateKey, true)
  if (!pubkey) {
    throw new Error('Invalid private key')
  }
  const xOnly = Buffer.from(pubkey.subarray(1, 33))
  const hasOddY = pubkey[0] === 0x03
  const key = hasOddY ? ecc.privateNegate(privateKey) : privateKey
  const tweak = taggedHash(TAP_TWEAK_TAG, xOnly)
  const tweaked = ecc.privateAdd(Buffer.from(key), tweak)
  if (!tweaked) {
    throw new Error('Invalid tweaked private key')
  }
  return Buffer.from(tweaked)
}

function encodeWitness(items: Buffer[]): Buffer {
  const chunks = [varuint.encode(items.length)]
  for (const item of items) {
    chunks.push(varuint.encode(item.length), item)
  }
  return Buffer.concat(chunks)
}

function decodeWitness(buffer: Buffer): Buffer[] {
  const items: Buffer[] = []
  let offset = 0
  const count = varuint.decode(buffer, offset)
  offset += varuint.decode.bytes
  for (let i = 0; i < count; i += 1) {
    const length = varuint.decode(buffer, offset)
    offset += varuint.decode.bytes
    items.push(buffer.subarray(offset, offset + length))
    offset += length
  }
  return items
}

function stripVariantPrefix(signatureBase64: string): string {
  const prefix = KNOWN_VARIANT_PREFIXES.find((candidate) =>
    signatureBase64.startsWith(candidate)
  )
  return prefix ? signatureBase64.slice(prefix.length) : signatureBase64
}

function getTaprootOutputKey(scriptPubKey: Buffer): Buffer | null {
  if (scriptPubKey.length !== 34 || scriptPubKey[0] !== opcodes.OP_1) {
    return null
  }
  return scriptPubKey.subarray(2)
}

/** Sign a message per BIP-322 "simple", taproot key-path spend only. */
export function signMessageBip322Taproot(
  privateKey: Buffer,
  address: string,
  message: string,
  network: AppNetwork
): string {
  const scriptPubKey = bjsAddress.toOutputScript(
    address,
    bitcoinjsNetwork(network)
  )
  if (!getTaprootOutputKey(scriptPubKey)) {
    throw new Error('BIP-322 signing is only supported for Taproot addresses')
  }
  const toSpendTx = buildToSpendTx(scriptPubKey, message)
  const sighash = buildToSignSighash(toSpendTx, scriptPubKey)
  const tweakedPrivateKey = tweakPrivateKey(privateKey)
  const signature = Buffer.from(ecc.signSchnorr(sighash, tweakedPrivateKey))
  return encodeWitness([signature]).toString('base64')
}

export function verifyMessageBip322Taproot(
  address: string,
  message: string,
  signatureBase64: string,
  network: AppNetwork
): boolean {
  try {
    const scriptPubKey = bjsAddress.toOutputScript(
      address,
      bitcoinjsNetwork(network)
    )
    const xOnlyPubkey = getTaprootOutputKey(scriptPubKey)
    if (!xOnlyPubkey) {
      return false
    }

    const witness = decodeWitness(
      Buffer.from(stripVariantPrefix(signatureBase64), 'base64')
    )
    if (
      witness.length !== 1 ||
      witness[0].length !== SCHNORR_SIGNATURE_LENGTH
    ) {
      return false
    }

    const toSpendTx = buildToSpendTx(scriptPubKey, message)
    const sighash = buildToSignSighash(toSpendTx, scriptPubKey)
    return ecc.verifySchnorr(sighash, xOnlyPubkey, witness[0])
  } catch {
    return false
  }
}
