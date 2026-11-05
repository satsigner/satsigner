import * as bitcoinjs from 'bitcoinjs-lib'

import {
  ARK_BOARD_INTENT_MIN_LIFETIME_RATIO,
  ARK_BOARD_MAX_FUNDING_INPUTS,
  ARK_BOARD_NATIVE_SEGWIT_OUTPUT_TYPES,
  ARK_BOARD_NATIVE_SEGWIT_SCRIPT_VERSIONS
} from '@/constants/ark'
import { type Account } from '@/types/models/Account'
import { type ArkBoardIntent } from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'
import {
  bitcoinjsNetwork,
  getScriptTypeFromOutputScript
} from '@/utils/bitcoin'
import { bytesEqual } from '@/utils/byteArray'

type ArkBoardCosignRejection =
  | 'duplicateBoardOutput'
  | 'invalidBoardAddress'
  | 'invalidPsbt'
  | 'invalidSignedTx'
  | 'missingBoardOutput'
  | 'missingPrevout'
  | 'nonNativeSegwitInput'
  | 'tooManyInputs'
  | 'txidMismatch'

type ArkBoardCosignPsbt =
  | { ok: true; psbtBase64: string; txid: string; amountSats: number }
  | { ok: false; reason: ArkBoardCosignRejection }

type BuildArkBoardCosignPsbtParams = {
  psbtBase64: string
  signedTxHex: string
  boardAddress: string
  network: Network
}

type Prevout = { script: Uint8Array; value: bigint }

function reject(reason: ArkBoardCosignRejection): ArkBoardCosignPsbt {
  return { ok: false, reason }
}

function parsePsbt(psbtBase64: string): bitcoinjs.Psbt | null {
  try {
    return bitcoinjs.Psbt.fromBase64(psbtBase64)
  } catch {
    return null
  }
}

function parseTxid(txHex: string): string | null {
  try {
    return bitcoinjs.Transaction.fromHex(txHex).getId()
  } catch {
    return null
  }
}

function outputScriptFor(address: string, network: Network): Uint8Array | null {
  try {
    return bitcoinjs.address.toOutputScript(address, bitcoinjsNetwork(network))
  } catch {
    return null
  }
}

function prevoutFromNonWitnessUtxo(
  nonWitnessUtxo: Uint8Array,
  outpoint: { hash: Uint8Array; index: number }
): Prevout | undefined {
  try {
    const prevTx = bitcoinjs.Transaction.fromBuffer(nonWitnessUtxo)
    if (!bytesEqual(prevTx.getHash(), outpoint.hash)) {
      return undefined
    }
    return prevTx.outs[outpoint.index]
  } catch {
    return undefined
  }
}

function prevoutForInput(
  psbt: bitcoinjs.Psbt,
  index: number
): Prevout | undefined {
  const { witnessUtxo, nonWitnessUtxo } = psbt.data.inputs[index]
  if (witnessUtxo) {
    return witnessUtxo
  }
  if (!nonWitnessUtxo) {
    return undefined
  }
  return prevoutFromNonWitnessUtxo(nonWitnessUtxo, psbt.txInputs[index])
}

function isNativeSegwitScript(script: Uint8Array): boolean {
  const scriptType = getScriptTypeFromOutputScript(script)
  return (
    scriptType !== null &&
    ARK_BOARD_NATIVE_SEGWIT_OUTPUT_TYPES.includes(scriptType)
  )
}

function unsignedTxid(psbt: bitcoinjs.Psbt): string {
  return bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  ).getId()
}

function buildUnsignedPsbt(
  source: bitcoinjs.Psbt,
  prevouts: Prevout[],
  network: Network
): bitcoinjs.Psbt {
  const psbt = new bitcoinjs.Psbt({ network: bitcoinjsNetwork(network) })
  psbt.setVersion(source.version)
  psbt.setLocktime(source.locktime)
  for (const [index, input] of source.txInputs.entries()) {
    psbt.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence,
      witnessUtxo: prevouts[index]
    })
  }
  for (const output of source.txOutputs) {
    psbt.addOutput({ script: output.script, value: output.value })
  }
  return psbt
}

/**
 * Builds the PSBT the Ark server cosigns for a single-transaction board.
 *
 * The board VTXO commits to the funding txid, so every input must be native
 * segwit (no scriptSig) and the signed transaction must hash to the same txid
 * as the unsigned skeleton. Only the skeleton and prevouts are shared with the
 * server: no signatures or derivation paths leave the device.
 */
function buildArkBoardCosignPsbt({
  psbtBase64,
  signedTxHex,
  boardAddress,
  network
}: BuildArkBoardCosignPsbtParams): ArkBoardCosignPsbt {
  const source = parsePsbt(psbtBase64)
  if (!source) {
    return reject('invalidPsbt')
  }
  if (source.txInputs.length > ARK_BOARD_MAX_FUNDING_INPUTS) {
    return reject('tooManyInputs')
  }

  const prevouts = source.txInputs.map((_, index) =>
    prevoutForInput(source, index)
  )
  const knownPrevouts = prevouts.filter(
    (prevout): prevout is Prevout => prevout !== undefined
  )
  if (knownPrevouts.length !== prevouts.length) {
    return reject('missingPrevout')
  }
  if (!knownPrevouts.every((prevout) => isNativeSegwitScript(prevout.script))) {
    return reject('nonNativeSegwitInput')
  }

  const boardScript = outputScriptFor(boardAddress, network)
  if (!boardScript) {
    return reject('invalidBoardAddress')
  }
  const boardOutputs = source.txOutputs.filter((output) =>
    bytesEqual(output.script, boardScript)
  )
  if (boardOutputs.length === 0) {
    return reject('missingBoardOutput')
  }
  if (boardOutputs.length > 1) {
    return reject('duplicateBoardOutput')
  }

  const signedTxid = parseTxid(signedTxHex)
  if (!signedTxid) {
    return reject('invalidSignedTx')
  }
  const cosignPsbt = buildUnsignedPsbt(source, knownPrevouts, network)
  const txid = unsignedTxid(cosignPsbt)
  if (txid !== signedTxid) {
    return reject('txidMismatch')
  }

  return {
    amountSats: Number(boardOutputs[0].value),
    ok: true,
    psbtBase64: cosignPsbt.toBase64(),
    txid
  }
}

// Bech32 addresses may be written in uppercase. Both spellings pay the same
// script, so a board output must match its intent either way.
function canonicalAddress(address: string): string {
  try {
    const { data, prefix, version } = bitcoinjs.address.fromBech32(address)
    return bitcoinjs.address.toBech32(data, version, prefix)
  } catch {
    return address
  }
}

function findArkBoardIntent(
  outputAddresses: (string | undefined)[],
  boardIntents: Record<string, ArkBoardIntent>
): ArkBoardIntent | undefined {
  const intentsByAddress = new Map(
    Object.values(boardIntents).map((intent) => [
      canonicalAddress(intent.address),
      intent
    ])
  )
  for (const address of outputAddresses) {
    const intent = address
      ? intentsByAddress.get(canonicalAddress(address))
      : undefined
    if (intent) {
      return intent
    }
  }
  return undefined
}

function canAccountFundArkBoard(
  account: Pick<Account, 'keys' | 'network'>,
  network: Network
): boolean {
  if (account.network !== network || account.keys.length === 0) {
    return false
  }
  return account.keys.every(
    ({ scriptVersion }) =>
      scriptVersion !== undefined &&
      ARK_BOARD_NATIVE_SEGWIT_SCRIPT_VERSIONS.includes(scriptVersion)
  )
}

function isArkBoardIntentFresh({
  expiryHeight,
  tipHeight,
  vtxoLifetime
}: {
  expiryHeight: number
  tipHeight: number
  vtxoLifetime: number
}): boolean {
  return (
    expiryHeight - tipHeight >=
    vtxoLifetime * ARK_BOARD_INTENT_MIN_LIFETIME_RATIO
  )
}

export {
  type ArkBoardCosignPsbt,
  type ArkBoardCosignRejection,
  buildArkBoardCosignPsbt,
  canAccountFundArkBoard,
  findArkBoardIntent,
  isArkBoardIntentFresh
}
