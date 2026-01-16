import { type Utxo } from '@/types/models/Utxo'

type _Utxo = Utxo & {
  effectiveValue?: number
  scriptType?: 'p2pkh' | 'p2wpkh' | 'p2sh-p2wpkh'
}

function getUtxoOutpoint(utxo: Utxo) {
  return `${utxo.txid}:${utxo.vout}`
}

type UtxoOptions = {
  dustThreshold: number
  inputSize: number
  changeOutputSize: number
}

type SelectedUtxos = {
  inputs: Utxo[]
  fee: number
  change: number
  error?: string
}

function selectEfficientUtxos(
  utxos: _Utxo[],
  targetAmount: number,
  feeRate: number,
  options?: UtxoOptions
): SelectedUtxos {
  // Default options
  const defaultOptions = {
    dustThreshold: 546, // Min UTXO value in satoshis (Bitcoin dust limit)
    changeOutputSize: 34, // Size of change output in bytes
    inputSize: 148 // Average size of input in bytes
  }

  const opts = { ...defaultOptions, ...options }

  // Calculate cost to spend each UTXO
  const costToSpend = opts.inputSize * feeRate

  // Filter out UTXOs that would cost more to spend than they're worth
  const spendableUtxos = utxos.filter((utxo) => utxo.value > costToSpend)

  // If no UTXOs are spendable after filtering, use all UTXOs as fallback
  const usableUtxos = spendableUtxos.length > 0 ? spendableUtxos : [...utxos]

  // Sort UTXOs by value (ascending)
  const sortedUtxos = [...usableUtxos].sort((a, b) => a.value - b.value)

  // Store our selection results
  const selectedUtxos = []
  let selectedAmount = 0
  let estimatedFee = 0
  let change = 0

  // First pass: Try exact match or closest match algorithm
  const exactMatch = sortedUtxos.find((utxo) => {
    // Account for the fee of using this single input
    const txFee = (opts.inputSize + opts.changeOutputSize) * feeRate
    const netValue = utxo.value - txFee

    // Allow a small margin of error (dust threshold)
    return Math.abs(netValue - targetAmount) < opts.dustThreshold
  })

  if (exactMatch)
    return {
      inputs: [exactMatch],
      fee: (opts.inputSize + opts.changeOutputSize) * feeRate,
      change:
        exactMatch.value -
        targetAmount -
        (opts.inputSize + opts.changeOutputSize) * feeRate
    }

  // Try branch and bound algorithm for optimal selection
  const result = branchAndBoundUtxoSelection(
    sortedUtxos,
    targetAmount,
    feeRate,
    opts
  )
  if (result) return result

  // Fallback to coin selection with accumulative strategy
  // Start with largest UTXOs (reverse the sorted list) for fewer inputs
  const reversedUtxos = [...sortedUtxos].reverse()

  for (const utxo of reversedUtxos) {
    selectedUtxos.push(utxo)
    selectedAmount += utxo.value

    // Calculate fee based on number of inputs and one output
    estimatedFee =
      (selectedUtxos.length * opts.inputSize + opts.changeOutputSize) * feeRate

    // If we have enough funds (including fees)
    if (selectedAmount >= targetAmount + estimatedFee) {
      change = selectedAmount - targetAmount - estimatedFee

      // If change is less than dust threshold, add it to the fee
      if (change < opts.dustThreshold) {
        change = 0
        estimatedFee += change
      }

      break
    }
  }

  // Insufficient funds
  if (selectedAmount < targetAmount + estimatedFee)
    return { inputs: [], fee: 0, change: 0, error: 'Insufficient funds' }

  return {
    inputs: selectedUtxos,
    fee: estimatedFee,
    change
  }
}

/**
 * Find a subset of UTXOs that exactly match the target amount
 */
function findExactMatch(utxos: _Utxo[], targetValue: number): Utxo[] | null {
  // This uses dynamic programming to find subset sum
  const n = utxos.length

  // Create a map where the value is the subset
  const dp = new Map()
  dp.set(0, [])

  for (let i = 0; i < n; i++) {
    const utxo = utxos[i]
    const effectiveValue = utxo.effectiveValue

    // Create a copy of current dp map to avoid modifying during iteration
    const currentDp = new Map(dp)

    for (const [value, subset] of currentDp.entries()) {
      const newValue = value + effectiveValue
      if (!dp.has(newValue)) {
        dp.set(newValue, [...subset, utxo])
      }

      if (newValue === targetValue) {
        return dp.get(newValue)
      }
    }
  }

  // Check if we have an exact match for the target value
  return dp.get(targetValue) || null
}

function branchAndBoundUtxoSelection(
  utxos: _Utxo[],
  targetAmount: number,
  feeRate: number,
  opts: UtxoOptions
): {
  inputs: Utxo[]
  fee: number
  change: number
} | null {
  const MAX_TRIES = 1000000
  const inputCost = opts.inputSize * feeRate

  // Calculate the effective value of each UTXO (value minus cost to spend it)
  const effectiveUtxos = utxos
    .map((utxo) => ({
      ...utxo,
      effectiveValue: utxo.value - inputCost
    }))
    .filter((utxo) => utxo.effectiveValue > 0) // Filter out UTXOs that cost more to spend

  if (effectiveUtxos.length === 0) {
    return null
  }

  // Calculate total effective value
  const totalEffectiveValue = effectiveUtxos.reduce(
    (sum, utxo) => sum + utxo.effectiveValue,
    0
  )

  // If total value is less than target, impossible to satisfy
  if (totalEffectiveValue < targetAmount) return null

  // If we have exact match, return it
  const exactMatchSet = findExactMatch(effectiveUtxos, targetAmount)
  if (exactMatchSet) {
    const fee = exactMatchSet.length * inputCost
    return {
      inputs: exactMatchSet,
      fee,
      change: 0 // No change as we have exact match
    }
  }

  // Apply Branch and Bound algorithm
  let bestSelection: _Utxo[] = []
  let bestWaste = Infinity

  // Function to search recursively
  function search(
    selection: _Utxo[],
    effectiveValue: number,
    depth: number,
    tries: number
  ): null | boolean {
    if (tries > MAX_TRIES) return false

    if (effectiveValue >= targetAmount) {
      // Calculate waste as the sum of all inputs minus target
      const waste = effectiveValue - targetAmount

      if (waste < bestWaste) {
        bestSelection = [...selection]
        bestWaste = waste
      }

      return true
    }

    if (depth >= effectiveUtxos.length) return false

    // Try including this UTXO
    selection.push(effectiveUtxos[depth])
    const withResult = search(
      selection,
      effectiveValue + effectiveUtxos[depth].effectiveValue,
      depth + 1,
      tries + 1
    )
    selection.pop()

    // Try excluding this UTXO
    const withoutResult = search(
      selection,
      effectiveValue,
      depth + 1,
      tries + 1
    )

    return withResult || withoutResult
  }

  // Start search with empty selection
  search([], 0, 0, 0)

  // If we found a selection
  if (bestSelection) {
    const fee = bestSelection.length * inputCost
    const change =
      bestSelection.reduce((sum: number, utxo: Utxo) => sum + utxo.value, 0) -
      targetAmount -
      fee

    // If change is less than dust, add it to fee
    if (change > 0 && change < opts.dustThreshold)
      return {
        inputs: bestSelection,
        fee: fee + change,
        change: 0
      }

    return {
      inputs: bestSelection,
      fee,
      change: change > 0 ? change : 0
    }
  }

  return null
}

export { getUtxoOutpoint, selectEfficientUtxos }
