import { type Utxo } from '@/types/models/Utxo'

type _Utxo = Utxo & {
  effectiveValue?: number
  scriptType?: 'p2pkh' | 'p2wpkh' | 'p2sh-p2wpkh'
}

type ChangeOutput = {
  type: string
  value: number
  size: number
}

function getUtxoOutpoint(utxo: Utxo) {
  return `${utxo.txid}:${utxo.vout}`
}

type UtxoOptions = {
  dustThreshold: number
  inputSize: number
  changeOutputSize: number
}

/**
 * Efficient UTXO Selection Algorithm
 * @param {Array} utxos - Array of available UTXOs
 * @param {Number} targetAmount - Amount to send in satoshis
 * @param {Number} feeRate - Fee rate in satoshis per byte
 * @param {Object} options - Additional options
 * @returns {Object} Selected UTXOs and change
 */
function selectEfficientUtxos(
  utxos: _Utxo[],
  targetAmount: number,
  feeRate: number,
  options?: UtxoOptions
): {
  inputs: Utxo[]
  fee: number
  change: number
  error?: string
} {
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
 * Branch and Bound UTXO selection algorithm
 * Selects UTXOs from a pool to meet a target value (payment amount) while keeping the transaction efficient by avoiding unnecessary change outputs when possible.
 * effectiveValue - used to determine the actual value that can be utilized from a group of UTXOs once fees are deducted
 */
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

type StonewallOptions = {
  recipientType?: string
  dustThreshold?: number
  minOutputs?: number
  maxOutputs?: number
  minInputs?: number
  maxInputs?: number
  sizeP2PKH?: number
  sizeP2WPKH?: number
  sizeP2SHP2WPKH?: number
  outputSizeP2PKH?: number
  outputSizeP2WPKH?: number
  txOverhead?: number
  maxAttempts?: number
}

/**
 * STONEWALL UTXO Selection Algorithm
 * * selects UTXOs to create two sets of inputs for a transaction, mimicking a CoinJoin-like structure to enhance privacy
 * https://mempool.space/tx/94e5a9a734cdf45ca7387aa786e0c01463ee9102e7e6342aa1712fece0af114f
 * Optimized for privacy by creating transactions that resemble multi-party transactions
 * ideallshould support only P2WPKH and P2PKH script types
 * Returns two UTxo sets with similar values
 *
 * @param {Array} utxos - Array of available UTXOs
 * @param {Number} targetAmount - Amount to send in satoshis
 * @param {Number} feeRate - Fee rate in satoshis per byte
 * @param {Object} options - Additional options
 * @returns {Object} Selected UTXOs, change outputs and metadata
 */
function selectStonewallUtxos(
  utxos: _Utxo[],
  targetAmount: number,
  feeRate: number,
  options: StonewallOptions = {}
): {
  inputs: Utxo[]
  outputs: ChangeOutput[]
  fee: number
  privacyScore: number
  txSize: number
  error?: string
} {
  // Default options
  const defaultOptions = {
    dustThreshold: 546,
    minOutputs: 2,
    maxOutputs: 4,
    minInputs: 4,
    maxInputs: 10,
    sizeP2PKH: 148,
    sizeP2WPKH: 68,
    sizeP2SHP2WPKH: 91,
    outputSizeP2PKH: 34,
    outputSizeP2WPKH: 31,
    txOverhead: 10,
    maxAttempts: 1000
  }

  const opts = { ...defaultOptions, ...options }

  // Check for insufficient funds early
  const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
  if (totalAvailable < targetAmount) {
    return {
      inputs: [],
      outputs: [],
      fee: 0,
      privacyScore: 0,
      txSize: 0,
      error: 'Insufficient funds'
    }
  }

  // Filter UTXOs based on postmix option
  const eligibleUtxos = [...utxos]

  // Get input size based on script type
  function getInputSize(utxo: Partial<Pick<_Utxo, 'scriptType'>>) {
    if (!utxo.scriptType) return opts.sizeP2PKH // Default to P2PKH

    switch (utxo.scriptType) {
      case 'p2wpkh':
        return opts.sizeP2WPKH
      case 'p2sh-p2wpkh':
        return opts.sizeP2SHP2WPKH
      default:
        return opts.sizeP2PKH
    }
  }

  // Get output size based on script type
  function getOutputSize(scriptType: string) {
    if (scriptType === 'p2wpkh') return opts.outputSizeP2WPKH
    return opts.outputSizeP2PKH
  }

  // Group UTXOs by script type to help with fingerprinting avoidance
  const utxosByType: { [key: string]: _Utxo[] } = {}
  eligibleUtxos.forEach((utxo) => {
    const type = utxo.scriptType || 'p2pkh'
    if (!utxosByType[type]) {
      utxosByType[type] = []
    }
    utxosByType[type].push(utxo)
  })

  // Sort UTXOs by size within each type
  Object.keys(utxosByType).forEach((type) => {
    utxosByType[type].sort(
      (a: { value: number }, b: { value: number }) => a.value - b.value
    )
  })

  // Try to find a suitable STONEWALL structure
  let bestSolution = null
  let bestPrivacyScore = 0

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    // Step 1: Decide how many outputs to create (including recipient)
    const numOutputs =
      Math.floor(Math.random() * (opts.maxOutputs - opts.minOutputs + 1)) +
      opts.minOutputs

    // Step 2: Decide how many inputs to use
    const numInputs =
      Math.floor(Math.random() * (opts.maxInputs - opts.minInputs + 1)) +
      opts.minInputs

    // Step 3: Select random script types for diversity (if available)
    const availableTypes = Object.keys(utxosByType).filter(
      (type) => utxosByType[type].length > 0
    )
    if (availableTypes.length === 0) continue

    // Simplified type selection
    const selectedTypes = [availableTypes[0]]

    // Step 4: Select inputs
    const selectedInputs = []
    let totalInputValue = 0

    // Try to select inputs from different types
    for (let i = 0; i < numInputs; i++) {
      const type = selectedTypes[0] // Always use the first available type

      if (utxosByType[type].length === 0) continue

      // Select a random UTXO from this type
      const typeUtxos = utxosByType[type]
      const randomIndex = Math.floor(Math.random() * typeUtxos.length)
      const selectedUtxo = typeUtxos[randomIndex]

      selectedInputs.push(selectedUtxo)
      totalInputValue += selectedUtxo.value

      // Remove the selected UTXO from the available pool
      utxosByType[type] = typeUtxos.filter(
        (_: _Utxo, idx: number) => idx !== randomIndex
      )
    }

    // Make sure we have enough funds with the selected inputs
    const selectedInputSizes = selectedInputs.map(getInputSize)
    const totalInputSize = selectedInputSizes.reduce(
      (sum, size) => sum + size,
      0
    )

    // Calculate base fee (inputs + recipient output + overhead)
    const recipientOutputSize = getOutputSize(options.recipientType || 'p2pkh')
    const baseFee =
      (totalInputSize + recipientOutputSize + opts.txOverhead) * feeRate

    // Calculate remaining amount for change outputs
    const remainingAmount = totalInputValue - targetAmount - baseFee

    // If we don't have enough funds, try again
    if (remainingAmount <= 0) continue

    // Step 5: Calculate change outputs
    const changeOutputs: ChangeOutput[] = []
    const numChangeOutputs = numOutputs - 1 // Excluding recipient

    if (numChangeOutputs <= 0) continue

    // Add sizes for change outputs
    let totalChangeOutputSize = 0
    const changeOutputSizes = []

    for (let i = 0; i < numChangeOutputs; i++) {
      // Randomly select script type for change
      const changeType =
        selectedTypes[Math.floor(Math.random() * selectedTypes.length)]
      const outputSize = getOutputSize(changeType)
      changeOutputSizes.push(outputSize)
      totalChangeOutputSize += outputSize
    }

    // Recalculate fee with change outputs
    const totalTxSize =
      totalInputSize +
      recipientOutputSize +
      totalChangeOutputSize +
      opts.txOverhead
    const totalFee = totalTxSize * feeRate

    // Calculate total available for change
    const totalChangeAmount = totalInputValue - targetAmount - totalFee

    // If total change is less than dust threshold * number of change outputs, try again
    if (totalChangeAmount < opts.dustThreshold * numChangeOutputs) continue

    // Distribute change amount across change outputs
    for (let i = 0; i < numChangeOutputs; i++) {
      let changeAmount

      if (i === numChangeOutputs - 1) {
        // Last change output gets the remainder
        changeAmount =
          changeOutputs.length > 0
            ? totalChangeAmount -
              changeOutputs.reduce((sum, output) => sum + output.value, 0)
            : totalChangeAmount
      } else {
        // Calculate a target change value based on an uneven distribution
        const baseAmount = totalChangeAmount / numChangeOutputs

        // Apply variance to avoid equal change outputs
        const variance = Math.random() * 0.4 - 0.2 // ±20%
        changeAmount = Math.floor(baseAmount * (1 + variance))
      }

      // Ensure change amount is above dust threshold
      if (changeAmount < opts.dustThreshold) continue

      // Create change output
      changeOutputs.push({
        type: selectedTypes[Math.floor(Math.random() * selectedTypes.length)],
        value: changeAmount,
        size: changeOutputSizes[i]
      })
    }

    // Make sure all change outputs are created and above dust
    if (changeOutputs.length !== numChangeOutputs) continue

    // Verify the total matches our calculations
    const finalTotalOutput =
      targetAmount +
      changeOutputs.reduce((sum, output) => sum + output.value, 0)
    const finalFee = totalInputValue - finalTotalOutput

    // Calculate privacy score (higher is better)
    let privacyScore = 0

    // More inputs and outputs = better privacy
    privacyScore += numInputs * 10
    privacyScore += numOutputs * 15

    // Variety of script types = better privacy
    privacyScore +=
      new Set(selectedInputs.map((utxo) => utxo.scriptType || 'p2pkh')).size *
      20
    privacyScore +=
      new Set(changeOutputs.map((output) => output.type)).size * 20

    // Balanced change outputs = better privacy
    if (changeOutputs.length > 1) {
      const values = changeOutputs.map((output) => output.value)
      const maxValue = Math.max(...values)
      const minValue = Math.min(...values)

      // More balanced outputs = higher score
      const balanceRatio = minValue / maxValue
      privacyScore += balanceRatio * 50
    }

    // Avoid amount correlation with inputs
    let hasExactInputMatch = false
    for (const input of selectedInputs) {
      if (
        input.value === targetAmount ||
        changeOutputs.some((output) => input.value === output.value)
      ) {
        hasExactInputMatch = true
        break
      }
    }
    if (!hasExactInputMatch) privacyScore += 30

    // Update best solution if this one has a better privacy score
    if (privacyScore > bestPrivacyScore) {
      bestPrivacyScore = privacyScore
      bestSolution = {
        inputs: selectedInputs,
        outputs: [
          {
            type: options.recipientType || 'p2pkh',
            value: targetAmount,
            size: getOutputSize(options.recipientType || 'p2pkh')
          },
          ...changeOutputs
        ],
        fee: finalFee,
        privacyScore,
        txSize: totalTxSize
      }
    }
  }

  if (!bestSolution) {
    return {
      inputs: [],
      outputs: [],
      fee: 0,
      privacyScore: 0,
      txSize: 0,
      error: 'Could not find a suitable STONEWALL structure'
    }
  }

  return bestSolution
}

/**
 * Calculates the entropy of a STONEWALL transaction
 * Higher entropy means better privacy
 *
 * @param {Object} solution - A STONEWALL transaction solution
 * @returns {Number} Entropy score
 */
function calculateStonewallEntropy(solution: {
  inputs: _Utxo[]
  outputs: ChangeOutput[]
}): number {
  if (!solution || !solution.inputs || !solution.outputs) {
    return 0
  }

  const inputs = solution.inputs
  const outputs = solution.outputs

  let entropy = 0

  const allValues = [
    ...inputs.map((i: { value: number }) => i.value),
    ...outputs.map((o: { value: number }) => o.value)
  ]
  const valueDistribution: { [key: number]: number } = {}

  allValues.forEach((value) => {
    valueDistribution[value] = (valueDistribution[value] || 0) + 1
  })

  // Calculate entropy
  const totalCount = allValues.length
  Object.values(valueDistribution).forEach((count) => {
    const probability = count / totalCount
    entropy -= probability * Math.log2(probability)
  })

  // Scale entropy to a 0-100 score
  const normalizedEntropy = Math.min(100, entropy * 25)

  return normalizedEntropy
}

/**
 * Creates different change output amounts that are not obviously related
 *
 * @param {Number} totalChange - Total change amount to distribute
 * @param {Number} numOutputs - Number of change outputs to create
 * @param {Number} dustThreshold - Minimum output value
 * @returns {Array} Array of change output amounts
 */
function distributeChangeWithPrivacy(
  totalChange: number,
  numOutputs: number,
  dustThreshold: number
): number[] {
  if (numOutputs <= 0) return []
  if (numOutputs === 1) return [totalChange]

  // Make sure we have enough for all outputs
  if (totalChange < dustThreshold * numOutputs) {
    return [totalChange]
  }

  const changeOutputs = []
  let remainingAmount = totalChange

  // Create n-1 outputs with privacy-focused values
  for (let i = 0; i < numOutputs - 1; i++) {
    // Calculate remaining average
    const avgRemaining = remainingAmount / (numOutputs - i)

    // Create a non-round number with some variance
    // Use different variance patterns to avoid fingerprinting
    let variance
    if (i % 3 === 0) {
      // Some outputs significantly smaller
      variance = 0.5 + Math.random() * 0.3
    } else if (i % 3 === 1) {
      // Some outputs slightly larger
      variance = 1.1 + Math.random() * 0.2
    } else {
      // Some outputs close to average
      variance = 0.9 + Math.random() * 0.2
    }

    // Calculate change amount
    let changeAmount = Math.floor(avgRemaining * variance)

    // Add some "noise" to avoid round numbers
    const noise = Math.floor(Math.random() * 100) - 50
    changeAmount += noise

    // Ensure we don't create dust and leave enough for remaining outputs
    const minRequired = dustThreshold * (numOutputs - i - 1)
    if (changeAmount < dustThreshold) {
      changeAmount = dustThreshold
    } else if (remainingAmount - changeAmount < minRequired) {
      changeAmount = remainingAmount - minRequired
    }

    changeOutputs.push(changeAmount)
    remainingAmount -= changeAmount
  }

  // Add the final output with remaining amount
  changeOutputs.push(remainingAmount)

  return changeOutputs
}

export {
  calculateStonewallEntropy,
  distributeChangeWithPrivacy,
  getUtxoOutpoint,
  selectEfficientUtxos,
  selectStonewallUtxos
}
