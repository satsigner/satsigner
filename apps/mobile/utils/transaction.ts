import { hex } from '@scure/base'
import * as bitcoinjs from 'bitcoinjs-lib'

import {
  HEX_PATTERN,
  LEGACY_INPUT_BYTES,
  LEGACY_OUTPUT_BYTES,
  LEGACY_TX_BASE_BYTES,
  MIN_TYPED_ADDRESS_LENGTH_TO_VALIDATE,
  PSBT_MAGIC_HEX,
  TXID_HEX_PATTERN,
  WITNESS_SCALE_FACTOR
} from '@/constants/btc'
import {
  BDK_DUST_ERROR_MARKER,
  BDK_UTXO_NOT_FOUND_ERROR_MARKER,
  MIN_RAW_TRANSACTION_HEX_LENGTH,
  TRANSACTION_ID_PLACEHOLDER,
  UNDECODABLE_OUTPUT_ADDRESS_PREFIX
} from '@/constants/transaction'
import type { ExtendedTransaction } from '@/hooks/useInputTransactions'
import type { Output } from '@/types/models/Output'
import { type PsbtBuildStatus } from '@/types/models/Psbt'
import { ScriptVersionType } from '@/types/models/Script'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import { type Network as AppNetwork } from '@/types/settings/blockchain'
import { type Message, type Notice } from '@/types/ui/notice'
import { getScriptVersionType } from '@/utils/address'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { validateAddress } from '@/utils/validation'

function areTransactionsEquivalent(a: Transaction, b: Transaction): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.sent === b.sent &&
    a.received === b.received &&
    a.blockHeight === b.blockHeight &&
    a.label === b.label &&
    a.prices?.USD === b.prices?.USD &&
    (a.timestamp?.getTime() ?? 0) === (b.timestamp?.getTime() ?? 0)
  )
}

/**
 * Every sync rebuilds all Transaction objects from scratch, so React sees new
 * references for rows that did not actually change and re-renders the whole
 * list. This reuses the previous object reference for any transaction whose
 * rendered fields are unchanged, so only genuinely-updated rows re-render.
 */
export function reconcileTransactions(
  previous: Transaction[],
  next: Transaction[]
): Transaction[] {
  if (previous.length === 0) {
    return next
  }
  const previousById = new Map(previous.map((tx) => [tx.id, tx]))
  return next.map((tx) => {
    const old = previousById.get(tx.id)
    return old && areTransactionsEquivalent(old, tx) ? old : tx
  })
}

const BASE_SIZE = 10
// Segwit marker + flag: 2 bytes, witness-discounted (1 weight unit each)
const SEGWIT_MARKER_FLAG_WEIGHT = 2

const INPUT_SIZES: Record<
  ScriptVersionType,
  { base: number; witness: number }
> = {
  P2PKH: { base: 147, witness: 0 },
  P2SH: { base: 147, witness: 0 },
  'P2SH-P2WPKH': { base: 91, witness: 107 },
  'P2SH-P2WSH': { base: 41, witness: 107 },
  P2TR: { base: 41, witness: 66 },
  P2WPKH: { base: 41, witness: 107 },
  P2WSH: { base: 41, witness: 107 }
}

const OUTPUT_SIZES: Record<ScriptVersionType, number> = {
  P2PKH: 34,
  // Every P2SH-wrapped type pays to the same 23-byte P2SH scriptPubKey
  // (OP_HASH160 <20> OP_EQUAL), so the output length is 8 + 1 + 23 = 32 vbytes.
  P2SH: 32,
  'P2SH-P2WPKH': 32,
  'P2SH-P2WSH': 32,
  P2TR: 43,
  P2WPKH: 31,
  P2WSH: 43
}

// Sparrow includes the segwit marker/flag (2 WU = 0.5 vbyte) in virtual size.
export const SEGWIT_OVERHEAD_VBYTES =
  SEGWIT_MARKER_FLAG_WEIGHT / WITNESS_SCALE_FACTOR

export function isSegwitInput(scriptType: ScriptVersionType): boolean {
  return INPUT_SIZES[scriptType].witness > 0
}

export function getUtxoScriptType(utxo: Utxo): ScriptVersionType {
  return utxo.addressTo
    ? getScriptVersionType(utxo.addressTo) || 'P2PKH'
    : 'P2PKH'
}

function getInputWeightUnits(scriptType: ScriptVersionType): number {
  const size = INPUT_SIZES[scriptType]
  return size.base * WITNESS_SCALE_FACTOR + size.witness
}

export function getInputVbytes(scriptType: ScriptVersionType): number {
  return getInputWeightUnits(scriptType) / WITNESS_SCALE_FACTOR
}

export function getOutputVbytes(scriptType: ScriptVersionType): number {
  return OUTPUT_SIZES[scriptType]
}

export function weightToVsize(weight: number) {
  return Math.ceil(weight / WITNESS_SCALE_FACTOR)
}

// TODO: To be removed
export function legacyEstimateTransactionSize(
  inputCount: number,
  outputCount: number
) {
  const totalSize =
    LEGACY_TX_BASE_BYTES +
    inputCount * LEGACY_INPUT_BYTES +
    outputCount * LEGACY_OUTPUT_BYTES
  // totalSize is in bytes, not weight units, so this under-reports a legacy
  // vsize. Kept as on master; the estimate is due for removal.
  const vsize = Math.ceil(totalSize / WITNESS_SCALE_FACTOR)

  return { size: totalSize, vsize }
}

export function estimateTransactionSize(
  inputs: Utxo[],
  outputs: Output[],
  hasChange?: boolean
) {
  const inputTypeSizes = inputs.map((utxo) => {
    const type: ScriptVersionType = utxo.addressTo
      ? getScriptVersionType(utxo.addressTo) || 'P2PKH'
      : 'P2PKH'
    const size = INPUT_SIZES[type]
    return size
  })

  const inputBase = inputTypeSizes.reduce((sum, i) => sum + i.base, 0)
  const inputWitness = inputTypeSizes.reduce((sum, i) => sum + i.witness, 0)

  const allOutputs = [...outputs]
  if (hasChange) {
    allOutputs.push({
      amount: 0, // Amount not need for size estimation
      label: 'change',
      localId: 'change-output',
      to: inputs[0].addressTo || '' // Assume that change address script type will be the same type of the first input
    })
  }

  const outputSize = allOutputs.reduce((sum, o) => {
    const type: ScriptVersionType = getScriptVersionType(o.to) || 'P2PKH'
    return sum + OUTPUT_SIZES[type]
  }, 0)

  const baseSize = BASE_SIZE + inputBase + outputSize

  const hasWitness = inputWitness > 0

  const weight = hasWitness
    ? baseSize * WITNESS_SCALE_FACTOR + inputWitness + SEGWIT_MARKER_FLAG_WEIGHT
    : baseSize * WITNESS_SCALE_FACTOR

  const size = hasWitness
    ? baseSize + inputWitness + SEGWIT_MARKER_FLAG_WEIGHT
    : baseSize
  const vsize = hasWitness ? weightToVsize(weight) : size

  return { size, vsize }
}

/**
 * Recalculates the depthH value for each transaction based on its dependencies.
 *
 * A transaction's depthH is calculated as follows:
 * 1. If a transaction has no dependencies within the set:
 *    - If its output is directly used as a selected input: set depthH to max calculated depthH
 *    - Otherwise: set depthH to 1
 * 2. If a transaction has dependencies, it gets a depthH of (max depthH of dependencies + 2)
 */

export function recalculateDepthH<T extends ExtendedTransaction>(
  transactions: Map<string, T>,
  selectedInputs?: Map<string, { value: number; scriptpubkey_address: string }>
): Map<string, T> {
  const updatedTransactions = new Map(transactions)

  // Build a dependency graph: txid -> [list of txids it depends on]
  const dependencyGraph = new Map<string, Set<string>>()

  for (const txid of updatedTransactions.keys()) {
    dependencyGraph.set(txid, new Set<string>())
  }

  for (const [txid, tx] of updatedTransactions.entries()) {
    for (const input of tx.vin) {
      const inputTxid = input.previousOutput.txid
      if (updatedTransactions.has(inputTxid)) {
        dependencyGraph.get(txid)?.add(inputTxid)
      }
    }
  }

  const processed = new Set<string>()
  let maxCalculatedDepthH = 1 // Track the maximum calculated depthH

  function processTransaction(txid: string, visited = new Set<string>()): void {
    if (visited.has(txid)) {
      return
    }

    if (processed.has(txid)) {
      return
    }

    visited.add(txid)

    const dependencies = dependencyGraph.get(txid) || new Set()
    for (const depTxid of dependencies) {
      processTransaction(depTxid, new Set(visited))
    }

    const tx = updatedTransactions.get(txid)
    if (tx) {
      if (dependencies.size === 0) {
        // No dependencies, set depthH to 1 for now
        tx.depthH = 1
      } else {
        // Get maximum depthH of dependencies and add 2
        let maxDepthH = 0
        for (const depTxid of dependencies) {
          const depTx = updatedTransactions.get(depTxid)
          if (depTx && depTx.depthH > maxDepthH) {
            maxDepthH = depTx.depthH
          }
        }
        tx.depthH = maxDepthH + 2
        maxCalculatedDepthH = Math.max(maxCalculatedDepthH, tx.depthH)
      }

      updatedTransactions.set(txid, tx)
      processed.add(txid)
    }
  }

  // Process all transactions first to establish the dependency chain
  for (const txid of updatedTransactions.keys()) {
    processTransaction(txid)
  }

  // Now handle the transactions with no dependencies
  for (const [txid, tx] of updatedTransactions.entries()) {
    if (dependencyGraph.get(txid)?.size === 0) {
      const isDirectlyConnectedToSelectedInput =
        selectedInputs &&
        tx.vout &&
        tx.vout.length > 0 &&
        tx.vout.some((output, idx) =>
          [...selectedInputs.entries()].some(([key, input]) => {
            const colon = key.lastIndexOf(':')
            const keyTxid = colon !== -1 ? key.slice(0, colon) : key
            const keyVout =
              colon !== -1 ? Number(key.slice(colon + 1)) : Number.NaN
            if (
              keyTxid.toLowerCase() === txid.toLowerCase() &&
              keyVout === idx
            ) {
              return true
            }
            const inputAddress = input.scriptpubkey_address || ''
            const outputAddress = output.address || ''
            if (input.value !== output.value) {
              return false
            }
            if (
              inputAddress &&
              outputAddress &&
              inputAddress !== outputAddress
            ) {
              return false
            }
            return inputAddress === outputAddress || !inputAddress
          })
        )

      // Check if this transaction is not an input to any other transaction in our set
      const isNotConnectedToOtherTx = [...updatedTransactions.values()].every(
        (otherTx) =>
          !otherTx.vin.some((input) => input.previousOutput.txid === txid)
      )

      // Set depthH based on whether it's connected to selected inputs and not to other transactions
      tx.depthH =
        isDirectlyConnectedToSelectedInput && isNotConnectedToOtherTx
          ? maxCalculatedDepthH
          : 1
      updatedTransactions.set(txid, tx)
    }
  }

  return updatedTransactions
}

export function assignOutputDepthOrder(
  transactions: Map<string, ExtendedTransaction>
) {
  const voutsByDepth = new Map<number, { txid: string; index: number }[]>()

  for (const [txid, tx] of transactions.entries()) {
    for (const [index] of (tx.vout ?? []).entries()) {
      const vouts = voutsByDepth.get(tx.depthH) ?? []
      vouts.push({ index, txid })
      voutsByDepth.set(tx.depthH, vouts)
    }
  }

  for (const vouts of voutsByDepth.values()) {
    for (const [depthOrder, { txid, index }] of vouts.entries()) {
      const tx = transactions.get(txid)
      if (tx?.vout?.[index]) {
        tx.vout[index] = { ...tx.vout[index], depthOrder }
      }
    }
  }

  return transactions
}

// Builds an unsigned transaction hex from the transaction builder inputs and
// outputs, for decoding/preview only. Inputs with an invalid txid are skipped;
// returns '' when any output address is invalid for the network.
export function buildPreviewTransactionHex(
  inputs: Map<string, Utxo>,
  outputs: Output[],
  network: AppNetwork
) {
  const transaction = new bitcoinjs.Transaction()
  const bitcoinjsNet = bitcoinjsNetwork(network)

  for (const input of inputs.values()) {
    if (!input.txid || !TXID_HEX_PATTERN.test(input.txid)) {
      continue
    }
    // bitcoinjs expects the hash in internal (little-endian) byte order.
    // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
    const hash = Buffer.from(hex.decode(input.txid)).reverse()
    transaction.addInput(hash, input.vout)
  }

  const canEncodeOutput = (output: Output) =>
    validateAddress(output.to, bitcoinjsNet) &&
    Number.isSafeInteger(output.amount) &&
    output.amount >= 0
  if (!outputs.every(canEncodeOutput)) {
    return ''
  }
  for (const output of outputs) {
    transaction.addOutput(
      bitcoinjs.address.toOutputScript(output.to, bitcoinjsNet),
      output.amount
    )
  }

  return transaction.toHex()
}

export function findFirstInvalidOutputAddress(
  outputs: Output[],
  network: AppNetwork
) {
  const bitcoinjsNet = bitcoinjsNetwork(network)
  const invalidOutput = outputs.find(
    (output) =>
      !output.to.startsWith(UNDECODABLE_OUTPUT_ADDRESS_PREFIX) &&
      output.to.trim().length >= MIN_TYPED_ADDRESS_LENGTH_TO_VALIDATE &&
      !validateAddress(output.to, bitcoinjsNet)
  )
  return invalidOutput?.to
}

// Builds the chart model (SSTransactionChart) of a not-yet-signed transaction
// from the transaction builder inputs and outputs.
export function buildChartTransactionFromBuilder(
  inputs: Map<string, Utxo>,
  outputs: Output[],
  id: string
): Transaction {
  const inputArray = [...inputs.values()]
  const { size, vsize } = estimateBuilderTransactionSize(inputs, outputs)

  return {
    id,
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    size,
    type: 'send',
    vin: inputArray.map((input) => ({
      label: input.label || '',
      previousOutput: { txid: input.txid, vout: input.vout },
      scriptSig: '',
      sequence: 0,
      value: input.value,
      witness: []
    })),
    vout: outputs.map((output) => ({
      address: output.to,
      kind: output.kind,
      label: output.label || '',
      script: '',
      value: output.amount
    })),
    vsize
  }
}

// Size of a transaction being built: per input script type when inputs are
// known, otherwise the legacy per-count estimate.
export function estimateBuilderTransactionSize(
  inputs: Map<string, Utxo>,
  outputs: Output[]
) {
  const inputArray = [...inputs.values()]
  return inputArray.length > 0
    ? estimateTransactionSize(inputArray, outputs)
    : legacyEstimateTransactionSize(inputs.size, outputs.length)
}

// Exact size of a finalized transaction hex, or null when the hex is not a
// parseable raw transaction (e.g. empty, or still a PSBT).
export function getFinalizedTransactionSize(transactionHex: string) {
  const trimmed = transactionHex.trim()
  const isRawTransactionHex =
    trimmed.length >= MIN_RAW_TRANSACTION_HEX_LENGTH &&
    HEX_PATTERN.test(trimmed) &&
    !trimmed.toLowerCase().startsWith(PSBT_MAGIC_HEX)
  if (!isRawTransactionHex) {
    return null
  }
  try {
    const transaction = bitcoinjs.Transaction.fromHex(trimmed)
    return {
      size: transaction.byteLength(true),
      vsize: transaction.virtualSize()
    }
  } catch {
    return null
  }
}

type BuildTransactionErrorDisplay = {
  isDust: boolean
  // Shown under the transaction id.
  message: Message
  // Reported as a toast; dust failures show a banner instead.
  notice: Notice | null
}

// How to show a failed preview build: dust gets a dedicated message, other
// errors show the library's own message.
export function mapBuildTransactionError(
  error: unknown
): BuildTransactionErrorDisplay {
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (errorMessage.toLowerCase().includes(BDK_DUST_ERROR_MARKER)) {
    return {
      isDust: true,
      message: { key: 'transaction.error.previewBuildFailedDust' },
      notice: null
    }
  }
  if (errorMessage.includes(BDK_UTXO_NOT_FOUND_ERROR_MARKER)) {
    return {
      isDust: false,
      message: { text: errorMessage },
      notice: { key: 'transaction.preview.utxoNotFound', type: 'error' }
    }
  }
  return {
    isDust: false,
    message: { text: errorMessage },
    notice: { text: errorMessage, type: 'error' }
  }
}

type TransactionIdDisplayParams = {
  isLoadingPSBT: boolean
  psbtBuildStatus: PsbtBuildStatus
  transactionId: string
}

// What to show as the transaction id while the PSBT loads, builds or failed.
export function getTransactionIdDisplay({
  isLoadingPSBT,
  psbtBuildStatus,
  transactionId
}: TransactionIdDisplayParams): Message {
  if (isLoadingPSBT) {
    return { key: 'common.loading' }
  }
  if (psbtBuildStatus === 'building') {
    return { key: 'transaction.preview.buildingTransaction' }
  }
  if (psbtBuildStatus === 'error' || !transactionId) {
    return { text: TRANSACTION_ID_PLACEHOLDER }
  }
  return { text: transactionId }
}
