import type { Transaction } from '../types/models/Transaction'

type TxNode = {
  tx: Transaction
  depth: number
}

export function calculateTransactionDepths(transactions: Transaction[]): Map<string, number> {
  const depthMap = new Map<string, number>()
  const txMap = new Map<string, Transaction>()
  
  // First, create a map of all transactions for easy lookup
  transactions.forEach(tx => {
    txMap.set(tx.id, tx)
  })

  // Helper function to calculate depth recursively
  function calculateDepth(txId: string, visited: Set<string> = new Set()): number {
    // If we've already calculated this tx's depth, return it
    if (depthMap.has(txId)) {
      return depthMap.get(txId)!
    }

    // Prevent infinite loops from circular dependencies
    if (visited.has(txId)) {
      return 0
    }

    const tx = txMap.get(txId)
    if (!tx || !tx.vin) {
      return 0
    }

    visited.add(txId)

    // Get the maximum depth of all input transactions
    let maxInputDepth = -1
    tx.vin.forEach(input => {
      const prevTxId = input.previousOutput.txid
      const inputDepth = calculateDepth(prevTxId, new Set(visited))
      maxInputDepth = Math.max(maxInputDepth, inputDepth)
    })

    // Current depth is max depth of inputs + 1
    const depth = maxInputDepth + 1
    depthMap.set(txId, depth)
    
    return depth
  }

  // Calculate depth for each transaction
  transactions.forEach(tx => {
    if (!depthMap.has(tx.id)) {
      calculateDepth(tx.id)
    }
  })

  return depthMap
}
