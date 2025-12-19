import type { ExtendedTransaction } from '@/hooks/useInputTransactions'
import { type ScriptVersionType } from '@/types/models/Account'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'

import { getScriptVersionType } from './address'

const BASE_SIZE = 10

const INPUT_SIZES: Record<
  ScriptVersionType,
  { base: number; witness: number }
> = {
  P2PKH: { base: 147, witness: 0 },
  P2SH: { base: 147, witness: 0 },
  P2WPKH: { base: 41, witness: 107 },
  P2WSH: { base: 41, witness: 107 },
  P2TR: { base: 41, witness: 66 },
  'P2SH-P2WPKH': { base: 91, witness: 107 },
  'P2SH-P2WSH': { base: 41, witness: 107 }
}

const OUTPUT_SIZES: Record<ScriptVersionType, number> = {
  P2PKH: 34,
  P2SH: 34,
  P2WPKH: 31,
  P2WSH: 43,
  P2TR: 43,
  'P2SH-P2WPKH': 31,
  'P2SH-P2WSH': 43
}

// TODO: To be removed
export function legacyEstimateTransactionSize(
  inputCount: number,
  outputCount: number
) {
  // Base transaction size (version + locktime)
  const baseSize = 10
  // Each input is roughly 148 bytes (outpoint[36] + script[~108] + sequence[4])
  const inputSize = inputCount * 148
  // Each output is roughly 34 bytes (value[8] + script[~26])
  const outputSize = outputCount * 34

  const totalSize = baseSize + inputSize + outputSize
  // Virtual size is weight/4
  const vsize = Math.ceil(totalSize * 0.25)

  return { size: totalSize, vsize }
}

export function estimateTransactionSize(
  inputs: Utxo[],
  outputs: Output[],
  hasChange?: boolean
) {
  const inputTypeSizes = inputs.map((utxo) => {
    const type = utxo.addressTo ? getScriptVersionType(utxo.addressTo) : 'P2PKH'
    const size = INPUT_SIZES[type || 'P2PKH']
    return size
  })

  const inputBase = inputTypeSizes.reduce((sum, i) => sum + i.base, 0)
  const inputWitness = inputTypeSizes.reduce((sum, i) => sum + i.witness, 0)

  const allOutputs = [...outputs]
  if (hasChange) {
    allOutputs.push({
      localId: 'change-output',
      to: inputs[0].addressTo || '', // Assume that change address script type will be the same type of the first input
      amount: 0, // Amount not need for size estimation
      label: 'change'
    })
  }

  const outputSize = allOutputs.reduce((sum, o) => {
    const type = getScriptVersionType(o.to) || 'P2PKH'
    return sum + OUTPUT_SIZES[type]
  }, 0)

  const baseSize = BASE_SIZE + inputBase + outputSize

  const hasWitness = inputWitness > 0
  const baseSizeWithMarker = hasWitness ? baseSize : baseSize

  const weight = hasWitness
    ? baseSizeWithMarker * 4 + inputWitness
    : baseSize * 3

  const size = hasWitness ? baseSizeWithMarker + inputWitness + 2 : baseSize
  const vsize = hasWitness ? Math.ceil(weight / 4) : size

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
  // Create a copy of the transactions map to avoid modifying the original
  const updatedTransactions = new Map(transactions)

  // Build a dependency graph: txid -> [list of txids it depends on]
  const dependencyGraph = new Map<string, Set<string>>()

  // Initialize the graph with empty dependency sets
  for (const txid of updatedTransactions.keys()) {
    dependencyGraph.set(txid, new Set<string>())
  }

  // Populate the dependency graph
  for (const [txid, tx] of updatedTransactions.entries()) {
    for (const input of tx.vin) {
      const inputTxid = input.previousOutput.txid
      // Only add dependencies for transactions in our set
      if (updatedTransactions.has(inputTxid)) {
        dependencyGraph.get(txid)?.add(inputTxid)
      }
    }
  }

  // Track which transactions have been processed
  const processed = new Set<string>()
  let maxCalculatedDepthH = 1 // Track the maximum calculated depthH

  // Process transactions in topological order (dependencies first)
  function processTransaction(txid: string, visited = new Set<string>()): void {
    // Check for circular dependencies
    if (visited.has(txid)) {
      return
    }

    // Skip if already processed
    if (processed.has(txid)) {
      return
    }

    visited.add(txid)

    // Process dependencies first
    const dependencies = dependencyGraph.get(txid) || new Set()
    for (const depTxid of dependencies) {
      processTransaction(depTxid, new Set(visited))
    }

    // Calculate depthH based on dependencies
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
        tx.vout.some((output) =>
          Array.from(selectedInputs.values()).some(
            (input) =>
              input.value === output.value &&
              input.scriptpubkey_address === output.address
          )
        )

      // Check if this transaction is not an input to any other transaction in our set
      const isNotConnectedToOtherTx = Array.from(
        updatedTransactions.values()
      ).every(
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
