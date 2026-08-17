import ecc from '@bitcoinerlab/secp256k1'
import {
  address as bjsAddress,
  crypto as bcrypto,
  initEccLib,
  opcodes,
  payments,
  script as bscript,
  Transaction
} from 'bitcoinjs-lib'
import * as varuint from 'varuint-bitcoin'

import { type Network as AppNetwork } from '@/types/settings/blockchain'
import { bitcoinjsNetwork, getScriptTypeFromAddress } from '@/utils/bitcoin'

initEccLib(ecc)

const BIP322_TAG = Buffer.from('BIP0322-signed-message', 'utf8')
const TAP_TWEAK_TAG = Buffer.from('TapTweak', 'utf8')
const ZERO_HASH = Buffer.alloc(32, 0)
const SCHNORR_SIGNATURE_LENGTH = 64
// "simple" variant text prefix from the BIP-322 spec, used by real-world
// wallets (e.g. Sparrow's drongo Bip322.java) - satsigner signs with it and
// tolerates it (or its "full"/"proof of funds" siblings) being absent on
// verify, for compatibility with implementations that predate this prefix.
const SIMPLE_VARIANT_PREFIX = 'smp'
const KNOWN_VARIANT_PREFIXES = [SIMPLE_VARIANT_PREFIX, 'ful']

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

function buildToSignTxSkeleton(toSpendTx: Transaction): Transaction {
  const toSignTx = new Transaction()
  toSignTx.version = 0
  toSignTx.locktime = 0
  toSignTx.addInput(toSpendTx.getHash(), 0, 0)
  toSignTx.addOutput(bscript.compile([opcodes.OP_RETURN]), 0)
  return toSignTx
}

function taprootSighash(
  toSignTx: Transaction,
  scriptPubKey: Buffer,
  hashType: number
): Buffer {
  return toSignTx.hashForWitnessV1(0, [scriptPubKey], [0], hashType)
}

/** The BIP-143 "scriptCode" for a P2WPKH output (also used for the P2WPKH redeem of a P2SH-P2WPKH output). */
function p2wpkhScriptCode(pubkeyHash: Buffer): Buffer {
  return bscript.compile([
    opcodes.OP_DUP,
    opcodes.OP_HASH160,
    pubkeyHash,
    opcodes.OP_EQUALVERIFY,
    opcodes.OP_CHECKSIG
  ])
}

function segwitV0Sighash(toSignTx: Transaction, pubkeyHash: Buffer): Buffer {
  return toSignTx.hashForWitnessV0(
    0,
    p2wpkhScriptCode(pubkeyHash),
    0,
    Transaction.SIGHASH_ALL
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

function encodeSimpleSignature(witness: Buffer[]): string {
  return SIMPLE_VARIANT_PREFIX + encodeWitness(witness).toString('base64')
}

function getTaprootOutputKey(scriptPubKey: Buffer): Buffer | null {
  if (scriptPubKey.length !== 34 || scriptPubKey[0] !== opcodes.OP_1) {
    return null
  }
  return scriptPubKey.subarray(2)
}

/**
 * Sign a message per BIP-322 "simple", taproot key-path spend only.
 * Uses SIGHASH_ALL (a 65-byte signature: 64-byte schnorr sig + explicit
 * hash-type byte), matching Sparrow's drongo Bip322.java, rather than the
 * shorter SIGHASH_DEFAULT form some other implementations produce - both
 * are spec-valid, this just matches real-world wallet output.
 */
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
  const toSignTx = buildToSignTxSkeleton(toSpendTx)
  const sighash = taprootSighash(
    toSignTx,
    scriptPubKey,
    Transaction.SIGHASH_ALL
  )
  const tweakedPrivateKey = tweakPrivateKey(privateKey)
  const signature = Buffer.from(ecc.signSchnorr(sighash, tweakedPrivateKey))
  const signatureWithHashType = Buffer.concat([
    signature,
    Buffer.from([Transaction.SIGHASH_ALL])
  ])
  return encodeSimpleSignature([signatureWithHashType])
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
    if (witness.length !== 1) {
      return false
    }

    // A 64-byte signature implies SIGHASH_DEFAULT (no hash-type byte); a
    // 65-byte signature carries an explicit hash-type as its last byte.
    const [taprootWitness] = witness
    let hashType = Transaction.SIGHASH_DEFAULT
    let signature = taprootWitness
    if (signature.length === SCHNORR_SIGNATURE_LENGTH + 1) {
      hashType = signature[SCHNORR_SIGNATURE_LENGTH]
      signature = signature.subarray(0, SCHNORR_SIGNATURE_LENGTH)
    }
    if (signature.length !== SCHNORR_SIGNATURE_LENGTH) {
      return false
    }

    const toSpendTx = buildToSpendTx(scriptPubKey, message)
    const toSignTx = buildToSignTxSkeleton(toSpendTx)
    const sighash = taprootSighash(toSignTx, scriptPubKey, hashType)
    return ecc.verifySchnorr(sighash, xOnlyPubkey, signature)
  } catch {
    return false
  }
}

/** Sign a message per BIP-322 "simple", P2WPKH / P2SH-P2WPKH key spend. */
export function signMessageBip322SegwitV0(
  privateKey: Buffer,
  address: string,
  message: string,
  network: AppNetwork
): string {
  const scriptPubKey = bjsAddress.toOutputScript(
    address,
    bitcoinjsNetwork(network)
  )
  const pubkey = ecc.pointFromScalar(privateKey, true)
  if (!pubkey) {
    throw new Error('Invalid private key')
  }
  const pubkeyHash = bcrypto.hash160(Buffer.from(pubkey))

  const toSpendTx = buildToSpendTx(scriptPubKey, message)
  const toSignTx = buildToSignTxSkeleton(toSpendTx)
  const sighash = segwitV0Sighash(toSignTx, pubkeyHash)
  const rawSignature = Buffer.from(ecc.sign(sighash, privateKey))
  const derSignature = bscript.signature.encode(
    rawSignature,
    Transaction.SIGHASH_ALL
  )
  return encodeSimpleSignature([derSignature, Buffer.from(pubkey)])
}

export function verifyMessageBip322SegwitV0(
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

    const witness = decodeWitness(
      Buffer.from(stripVariantPrefix(signatureBase64), 'base64')
    )
    if (witness.length !== 2) {
      return false
    }
    const [derSignature, pubkey] = witness
    const { hashType, signature } = bscript.signature.decode(derSignature)

    const pubkeyHash = bcrypto.hash160(pubkey)
    const p2wpkhOutput = payments.p2wpkh({ hash: pubkeyHash }).output
    if (!p2wpkhOutput) {
      return false
    }
    const p2shOutput = payments.p2sh({
      redeem: { output: p2wpkhOutput }
    }).output
    const matchesScriptPubKey =
      p2wpkhOutput.equals(scriptPubKey) ||
      (p2shOutput ? p2shOutput.equals(scriptPubKey) : false)
    if (!matchesScriptPubKey) {
      return false
    }

    const toSpendTx = buildToSpendTx(scriptPubKey, message)
    const toSignTx = buildToSignTxSkeleton(toSpendTx)
    const sighash = toSignTx.hashForWitnessV0(
      0,
      p2wpkhScriptCode(pubkeyHash),
      0,
      hashType
    )
    return ecc.verify(sighash, pubkey, signature)
  } catch {
    return false
  }
}

/** Dispatches to the taproot or segwit-v0 BIP-322 signer based on address type. */
export function signMessageBip322(
  privateKey: Buffer,
  address: string,
  message: string,
  network: AppNetwork
): string {
  const scriptType = getScriptTypeFromAddress(address, network)
  if (scriptType === 'p2tr') {
    return signMessageBip322Taproot(privateKey, address, message, network)
  }
  if (scriptType === 'p2wpkh' || scriptType === 'p2sh') {
    return signMessageBip322SegwitV0(privateKey, address, message, network)
  }
  throw new Error(`BIP-322 signing is not supported for this address type`)
}

/** Dispatches to the taproot or segwit-v0 BIP-322 verifier based on address type. */
export function verifyMessageBip322(
  address: string,
  message: string,
  signatureBase64: string,
  network: AppNetwork
): boolean {
  const scriptType = getScriptTypeFromAddress(address, network)
  if (scriptType === 'p2tr') {
    return verifyMessageBip322Taproot(
      address,
      message,
      signatureBase64,
      network
    )
  }
  if (scriptType === 'p2wpkh' || scriptType === 'p2sh') {
    return verifyMessageBip322SegwitV0(
      address,
      message,
      signatureBase64,
      network
    )
  }
  return false
}
