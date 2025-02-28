export function estimateTransactionSize(
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

/**
 * Recalculates the depthH value for each transaction based on its dependencies.
 *
 * A transaction's depthH is calculated as follows:
 * 1. If a transaction has no dependencies within the set, it gets a depthH of 1
 * 2. If a transaction has dependencies, it gets a depthH of (max depthH of dependencies + 2)
 *
 * This ensures that if transaction B depends on transaction A (A's output is B's input),
 * then B's depthH will be at least 2 higher than A's.
 *
 * @param transactions Map of transaction IDs to transaction objects
 * @returns The updated map of transactions with recalculated depthH values
 */
export function recalculateDepthH<
  T extends {
    txid: string
    vin: { txid: string; vout: number }[]
    depthH: number
  }
>(transactions: Map<string, T>): Map<string, T> {
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
      const inputTxid = input.txid
      // Only add dependencies for transactions in our set
      if (updatedTransactions.has(inputTxid)) {
        dependencyGraph.get(txid)?.add(inputTxid)
      }
    }
  }

  // Track which transactions have been processed
  const processed = new Set<string>()

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
        // No dependencies, assign minimum depthH of 1
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
      }

      updatedTransactions.set(txid, tx)
      processed.add(txid)
    }
  }

  // Process all transactions
  for (const txid of updatedTransactions.keys()) {
    processTransaction(txid)
  }

  return updatedTransactions
}
