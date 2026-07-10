import { DUST_LIMIT } from '@/constants/btc'
import { type Address } from '@/types/models/Address'
import { type Output } from '@/types/models/Output'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Utxo } from '@/types/models/Utxo'
import { getScriptVersionType } from '@/utils/address'
import { shuffle, shuffleWithJavaRandom } from '@/utils/array'
import { javaSeededRandom, randomNum, seededRandom } from '@/utils/crypto'
import {
  getInputVbytes,
  getOutputVbytes,
  getUtxoScriptType,
  isSegwitInput,
  SEGWIT_OVERHEAD_VBYTES
} from '@/utils/transaction'

const DEFAULT_LONG_TERM_FEE_RATE = 5
const SELECTION_SEED_MAX = 0x1_0000_0000
const BASE_TX_OVERHEAD_VBYTES = 10
const DEFAULT_CHANGE_SCRIPT_TYPE: ScriptVersionType = 'P2WPKH'
const DEFAULT_RECIPIENT_SCRIPT_TYPE: ScriptVersionType = 'P2WPKH'

const BNB_TOTAL_TRIES = 100_000
const KNAPSACK_ITERATIONS = 1000
// Sparrow uses SATOSHIS_PER_BITCOIN / 1000 as the knapsack minimum change
const KNAPSACK_MIN_CHANGE = 100_000
const STONEWALL_ATTEMPTS = 15
// Sparrow StonewallUtxoSelector uses new Random(42) for deterministic set building
const STONEWALL_SELECTION_SEED = 42

type SelectionStrategy = 'efficiency' | 'privacy'

type UtxoSelectionOptions = {
  addresses?: Pick<Address, 'address' | 'index' | 'keychain'>[]
  dustThreshold: number
  longTermFeeRate: number
  outputs: Output[]
  changeScriptType: ScriptVersionType
  recipientScriptType: ScriptVersionType
  seed: number
  feeFn?: (inputCount: number, hasChange: boolean) => number
}

type StonewallChangeOutput = {
  amount: number
  to: string
}

type SelectionResult = {
  inputs: Utxo[]
  fee: number
  change: number
  error?: string
}

type StonewallOutputType = 'recipient' | 'fakeMix' | 'change'

type StonewallOutput = {
  type: StonewallOutputType
  scriptType: ScriptVersionType
  value: number
}

type StonewallResult = {
  inputs: Utxo[]
  outputs: StonewallOutput[]
  fee: number
  error?: string
}

type OutputGroup = {
  utxos: Utxo[]
  scriptType: ScriptVersionType
  value: number
  effectiveValue: number
  fee: number
  longTermFee: number
}

function getUtxoOutpoint(utxo: Utxo) {
  return `${utxo.txid}:${utxo.vout}`
}

function sumValue(groups: OutputGroup[]) {
  return groups.reduce((sum, group) => sum + group.value, 0)
}

function sumEffectiveValue(groups: OutputGroup[]) {
  return groups.reduce((sum, group) => sum + group.effectiveValue, 0)
}

function flattenUtxos(groups: OutputGroup[]) {
  return groups.flatMap((group) => group.utxos)
}

function keychainRank(keychain?: Address['keychain']) {
  return keychain === 'internal' ? 1 : 0
}

/**
 * Orders UTXOs like Sparrow's getGroupedUtxos: external addresses first, then
 * internal, each in derivation index order, then txid/vout within an address.
 */
function sortUtxosForSparrowSelection(
  utxos: Utxo[],
  addresses?: Pick<Address, 'address' | 'index' | 'keychain'>[]
): Utxo[] {
  if (!addresses?.length) {
    return [...utxos].toSorted((a, b) => {
      const keychainDiff = keychainRank(a.keychain) - keychainRank(b.keychain)
      if (keychainDiff !== 0) {
        return keychainDiff
      }

      const addressDiff = (a.addressTo || '').localeCompare(b.addressTo || '')
      if (addressDiff !== 0) {
        return addressDiff
      }

      const txidDiff = a.txid.localeCompare(b.txid)
      if (txidDiff !== 0) {
        return txidDiff
      }

      return a.vout - b.vout
    })
  }

  const addressRank = new Map<string, number>()
  const sortedAddresses = [...addresses].toSorted((a, b) => {
    const keychainDiff = keychainRank(a.keychain) - keychainRank(b.keychain)
    if (keychainDiff !== 0) {
      return keychainDiff
    }

    return (a.index ?? 0) - (b.index ?? 0)
  })

  for (const [index, address] of sortedAddresses.entries()) {
    addressRank.set(address.address, index)
  }

  return [...utxos].toSorted((a, b) => {
    const rankA = addressRank.get(a.addressTo || '') ?? Number.MAX_SAFE_INTEGER
    const rankB = addressRank.get(b.addressTo || '') ?? Number.MAX_SAFE_INTEGER
    if (rankA !== rankB) {
      return rankA - rankB
    }

    const txidDiff = a.txid.localeCompare(b.txid)
    if (txidDiff !== 0) {
      return txidDiff
    }

    return a.vout - b.vout
  })
}

/**
 * Groups UTXOs sharing an address so reused addresses are always co-spent,
 * matching Sparrow's OutputGroup. Effective value is the UTXO value minus the
 * fee to spend it at the given fee rate.
 */
function buildOutputGroups(
  utxos: Utxo[],
  feeRate: number,
  longTermFeeRate: number
): OutputGroup[] {
  const groups = new Map<string, OutputGroup>()

  for (const utxo of utxos) {
    const scriptType = getUtxoScriptType(utxo)
    const inputVbytes = getInputVbytes(scriptType)
    // Sparrow truncates (long cast) rather than rounds: floor(WU * rate / 4)
    const fee = Math.floor(inputVbytes * feeRate)
    const longTermFee = Math.floor(inputVbytes * longTermFeeRate)
    const key = utxo.addressTo || getUtxoOutpoint(utxo)

    const existing = groups.get(key)
    if (existing) {
      existing.utxos.push(utxo)
      existing.value += utxo.value
      existing.effectiveValue += utxo.value - fee
      existing.fee += fee
      existing.longTermFee += longTermFee
      continue
    }

    groups.set(key, {
      effectiveValue: utxo.value - fee,
      fee,
      longTermFee,
      scriptType,
      utxos: [utxo],
      value: utxo.value
    })
  }

  return Array.from(groups.values())
}

function getRecipientVbytes(
  outputs: Output[],
  recipientScriptType: ScriptVersionType
): number {
  if (outputs.length === 0) {
    return getOutputVbytes(recipientScriptType)
  }
  return outputs.reduce(
    (sum, output) =>
      sum + getOutputVbytes(getScriptVersionType(output.to) || 'P2PKH'),
    0
  )
}

/**
 * Fee of the transaction skeleton (overhead + recipient outputs) before any
 * inputs or change are added. Mirrors Sparrow's noInputsFee.
 */
function getNoInputsFee(
  outputs: Output[],
  feeRate: number,
  recipientScriptType: ScriptVersionType,
  walletScriptType: ScriptVersionType
): number {
  const recipientVbytes = getRecipientVbytes(outputs, recipientScriptType)
  // Sparrow sets the segwit flag (0.5 vbyte) when the wallet spends witness inputs.
  const segwitOverhead = isSegwitInput(walletScriptType)
    ? SEGWIT_OVERHEAD_VBYTES
    : 0
  // Sparrow ceils the no-inputs weight: ceil(noInputsWU * rate / 4)
  return Math.ceil(
    (BASE_TX_OVERHEAD_VBYTES + segwitOverhead + recipientVbytes) * feeRate
  )
}

/**
 * Cost of having a change output: the fee to create it now plus the fee to
 * spend it later at the long term fee rate. Below this, change is not worth
 * keeping and is absorbed into the fee. Mirrors Sparrow's getCostOfChange.
 */
function getCostOfChange(
  feeRate: number,
  longTermFeeRate: number,
  changeScriptType: ScriptVersionType
): number {
  const changeOutputVbytes = getOutputVbytes(changeScriptType)
  // Sparrow's getInputVbytes ceils WU/4, and getFee truncates the final sum
  const changeInputVbytes = Math.ceil(getInputVbytes(changeScriptType))
  return Math.floor(
    changeOutputVbytes * feeRate + changeInputVbytes * longTermFeeRate
  )
}

/**
 * Branch and Bound selection (Sparrow/Bitcoin Core port). Finds a changeless
 * input set whose effective value lands within [target, target + costOfChange]
 * while minimising waste (excess value + fee vs long term fee). Returns null
 * when no such set exists, so callers can fall back to another selector.
 */
function selectBranchAndBound(
  target: number,
  groups: OutputGroup[],
  noInputsFee: number,
  costOfChange: number
): OutputGroup[] | null {
  const pool = [...groups].toSorted(
    (a, b) => b.effectiveValue - a.effectiveValue
  )
  const actualTarget = target + noInputsFee

  let currentAvailableValue = sumEffectiveValue(pool)
  // Sparrow guards against the raw target here (not target + noInputsFee)
  if (currentAvailableValue < target) {
    return null
  }

  const selection: boolean[] = []
  let currentValue = 0
  let currentWaste = 0
  let bestSelection: boolean[] | null = null
  let bestWaste = Number.MAX_SAFE_INTEGER

  for (let tries = 0; tries < BNB_TOTAL_TRIES; tries += 1) {
    let backtrack = false

    if (
      currentValue + currentAvailableValue < actualTarget ||
      currentValue > actualTarget + costOfChange ||
      (currentWaste > bestWaste &&
        pool.length > 0 &&
        pool[0].fee - pool[0].longTermFee > 0)
    ) {
      backtrack = true
    } else if (currentValue >= actualTarget) {
      currentWaste += currentValue - actualTarget
      if (currentWaste <= bestWaste) {
        bestSelection = [...selection]
        bestWaste = currentWaste
      }
      currentWaste -= currentValue - actualTarget
      backtrack = true
    }

    if (backtrack) {
      while (selection.length > 0 && !selection.at(-1)) {
        selection.pop()
        currentAvailableValue += pool[selection.length].effectiveValue
      }

      if (selection.length === 0) {
        break
      }

      selection[selection.length - 1] = false
      const group = pool[selection.length - 1]
      currentValue -= group.effectiveValue
      currentWaste -= group.fee - group.longTermFee
      continue
    }

    const group = pool[selection.length]
    currentAvailableValue -= group.effectiveValue

    const previousIndex = selection.length - 1
    const skipEquivalent =
      selection.length > 0 &&
      !selection[previousIndex] &&
      group.effectiveValue === pool[previousIndex].effectiveValue &&
      group.fee === pool[previousIndex].fee

    if (skipEquivalent) {
      selection.push(false)
    } else {
      selection.push(true)
      currentValue += group.effectiveValue
      currentWaste += group.fee - group.longTermFee
    }
  }

  if (!bestSelection || bestSelection.length === 0) {
    return null
  }

  const selected = pool.filter((_, index) => bestSelection?.[index])
  return selected.length > 0 ? selected : null
}

function findApproximateBestSubset(
  groups: OutputGroup[],
  totalLower: number,
  target: number,
  bestSelection: boolean[],
  random: () => number
): number {
  bestSelection.fill(true)
  let bestValue = totalLower

  for (
    let rep = 0;
    rep < KNAPSACK_ITERATIONS && bestValue !== target;
    rep += 1
  ) {
    const included = Array.from({ length: groups.length }, () => false)
    let total = 0
    let reachedTarget = false

    for (let pass = 0; pass < 2 && !reachedTarget; pass += 1) {
      for (let i = 0; i < groups.length; i += 1) {
        const take = pass === 0 ? random() < 0.5 : !included[i]
        if (!take) {
          continue
        }

        total += groups[i].effectiveValue
        included[i] = true

        if (total >= target) {
          reachedTarget = true
          if (total < bestValue) {
            bestValue = total
            for (let k = 0; k < groups.length; k += 1) {
              bestSelection[k] = included[k]
            }
          }
          total -= groups[i].effectiveValue
          included[i] = false
        }
      }
    }
  }

  return bestValue
}

/**
 * Knapsack selection (Sparrow port). Stochastic subset-sum approximation used
 * as a fallback when Branch and Bound finds no changeless solution.
 */
function selectKnapsack(
  target: number,
  groups: OutputGroup[],
  noInputsFee: number,
  random: () => number
): OutputGroup[] | null {
  const actualTarget = target + noInputsFee
  const shuffled = shuffle(groups, random)

  let lowestLarger: OutputGroup | null = null
  const applicable: OutputGroup[] = []
  let totalLower = 0

  for (const group of shuffled) {
    if (group.effectiveValue === actualTarget) {
      return [group]
    }
    if (group.effectiveValue < actualTarget + KNAPSACK_MIN_CHANGE) {
      applicable.push(group)
      totalLower += group.effectiveValue
    } else if (
      lowestLarger === null ||
      group.effectiveValue < lowestLarger.effectiveValue
    ) {
      lowestLarger = group
    }
  }

  if (totalLower === actualTarget) {
    return applicable
  }

  if (totalLower < actualTarget) {
    return lowestLarger ? [lowestLarger] : null
  }

  applicable.sort((a, b) => b.effectiveValue - a.effectiveValue)
  const bestSelection = Array.from({ length: applicable.length }, () => false)

  let bestValue = findApproximateBestSubset(
    applicable,
    totalLower,
    actualTarget,
    bestSelection,
    random
  )
  if (
    bestValue !== actualTarget &&
    totalLower >= actualTarget + KNAPSACK_MIN_CHANGE
  ) {
    bestValue = findApproximateBestSubset(
      applicable,
      totalLower,
      actualTarget + KNAPSACK_MIN_CHANGE,
      bestSelection,
      random
    )
  }

  if (
    lowestLarger !== null &&
    ((bestValue !== actualTarget &&
      bestValue < actualTarget + KNAPSACK_MIN_CHANGE) ||
      lowestLarger.effectiveValue <= bestValue)
  ) {
    return [lowestLarger]
  }

  return applicable.filter((_, index) => bestSelection[index])
}

/**
 * Accumulative largest-first fallback. Used only when both Branch and Bound
 * and Knapsack fail to return a set.
 */
function selectAccumulative(
  target: number,
  groups: OutputGroup[],
  noInputsFee: number
): OutputGroup[] | null {
  const sorted = [...groups].toSorted(
    (a, b) => b.effectiveValue - a.effectiveValue
  )
  const actualTarget = target + noInputsFee
  const selected: OutputGroup[] = []
  let effectiveValue = 0

  for (const group of sorted) {
    selected.push(group)
    effectiveValue += group.effectiveValue
    if (effectiveValue >= actualTarget) {
      return selected
    }
  }

  return null
}

function takeUntilTarget(
  target: number,
  selectedSet: OutputGroup[],
  available: OutputGroup[]
): number {
  let selectedValue = 0
  while (selectedValue <= target && available.length > 0) {
    const candidate = available.shift()
    if (!candidate) {
      break
    }
    selectedSet.push(candidate)
    selectedValue += candidate.effectiveValue
  }
  return selectedValue
}

/**
 * Drops output groups that share a transaction with an already-kept group,
 * keeping the higher-value one. Mirrors Sparrow's getTransactionAlreadySelected
 * so STONEWALL never spreads UTXOs from one transaction across both sets.
 */
function dedupeByTransaction(groups: OutputGroup[]): OutputGroup[] {
  const unique: OutputGroup[] = []
  for (const candidate of groups) {
    const candidateTxids = new Set(candidate.utxos.map((utxo) => utxo.txid))
    const existingIndex = unique.findIndex((group) =>
      group.utxos.some((utxo) => candidateTxids.has(utxo.txid))
    )
    if (existingIndex === -1) {
      unique.push(candidate)
      continue
    }
    if (candidate.value > unique[existingIndex].value) {
      unique.splice(existingIndex, 1)
      unique.push(candidate)
    }
  }
  return unique
}

function stonewallTry(
  target: number,
  candidates: OutputGroup[],
  actualTarget: number,
  random: { nextInt(bound: number): number }
): OutputGroup[][] | null {
  for (let attempt = 0; attempt < STONEWALL_ATTEMPTS; attempt += 1) {
    const randomized = shuffleWithJavaRandom(candidates, random)

    const set1: OutputGroup[] = []
    const value1 = takeUntilTarget(actualTarget, set1, randomized)

    const set2: OutputGroup[] = []
    const value2 = takeUntilTarget(actualTarget, set2, randomized)

    if (value1 >= target && value2 >= target) {
      return [set1, set2]
    }
  }

  return null
}

/**
 * STONEWALL selection (Sparrow/Samourai port). Picks two independent input
 * sets that each cover the target, so the resulting transaction resembles a
 * two-party coinjoin. Prefers the recipient script type for the inputs.
 */
function selectStonewallSets(
  target: number,
  groups: OutputGroup[],
  noInputsFee: number,
  preferredScriptType: ScriptVersionType,
  random: { nextInt(bound: number): number }
): OutputGroup[][] | null {
  const actualTarget = target + noInputsFee
  const uniqueGroups = dedupeByTransaction(groups)

  const preferred = uniqueGroups.filter(
    (group) => group.scriptType === preferredScriptType
  )
  const preferredSets = stonewallTry(target, preferred, actualTarget, random)
  if (preferredSets) {
    return preferredSets
  }

  return stonewallTry(target, uniqueGroups, actualTarget, random)
}

function estimateFee(
  inputs: Utxo[],
  outputVbytes: number,
  feeRate: number
): number {
  const inputVbytes = inputs.reduce(
    (sum, utxo) => sum + getInputVbytes(getUtxoScriptType(utxo)),
    0
  )
  const segwitOverhead = inputs.some((utxo) =>
    isSegwitInput(getUtxoScriptType(utxo))
  )
    ? SEGWIT_OVERHEAD_VBYTES
    : 0
  // Sparrow's getRequiredFeeAmount truncates: floor(rate * virtualSize)
  return Math.floor(
    (BASE_TX_OVERHEAD_VBYTES + segwitOverhead + inputVbytes + outputVbytes) *
      feeRate
  )
}

function buildSingleSetResult(
  groups: OutputGroup[],
  target: number,
  feeRate: number,
  costOfChange: number,
  options: UtxoSelectionOptions
): SelectionResult {
  const inputs = flattenUtxos(groups)
  const totalValue = sumValue(groups)

  const recipientVbytes = getRecipientVbytes(
    options.outputs,
    options.recipientScriptType
  )
  const changeVbytes = getOutputVbytes(options.changeScriptType)

  const feeWithChange = options.feeFn
    ? options.feeFn(inputs.length, true)
    : estimateFee(inputs, recipientVbytes + changeVbytes, feeRate)
  const feeWithoutChange = options.feeFn
    ? options.feeFn(inputs.length, false)
    : estimateFee(inputs, recipientVbytes, feeRate)

  if (totalValue < target + feeWithoutChange) {
    return { change: 0, error: 'Insufficient funds', fee: 0, inputs: [] }
  }

  const change = totalValue - target - feeWithChange
  const minChange = Math.max(costOfChange, options.dustThreshold)

  if (change < minChange) {
    return { change: 0, fee: totalValue - target, inputs }
  }

  return { change, fee: feeWithChange, inputs }
}

function buildStonewallResult(
  sets: OutputGroup[][],
  target: number,
  feeRate: number,
  options: UtxoSelectionOptions
): StonewallResult {
  const numSets = sets.length
  const allInputs = sets.flatMap(flattenUtxos)

  const recipientVbytes = getRecipientVbytes(
    options.outputs,
    options.recipientScriptType
  )
  // recipient + one fake-mix output per extra set + one change output per set
  const fakeMixVbytes =
    (numSets - 1) * getOutputVbytes(options.recipientScriptType)
  const changeVbytes = numSets * getOutputVbytes(options.changeScriptType)
  const rawFee = estimateFee(
    allInputs,
    recipientVbytes + fakeMixVbytes + changeVbytes,
    feeRate
  )
  // Round the fee up to a multiple of numSets so it splits evenly across sets
  // and no satoshis are lost. Mirrors Sparrow's changeFeeRequiredAmt rounding.
  const fee = rawFee + ((numSets - (rawFee % numSets)) % numSets)
  const feePerSet = fee / numSets
  const minChange = Math.max(
    getCostOfChange(feeRate, options.longTermFeeRate, options.changeScriptType),
    options.dustThreshold
  )

  const changeOutputs: StonewallOutput[] = []
  for (const set of sets) {
    const setValue = sumValue(set)
    const changeValue = setValue - target - feePerSet
    if (changeValue < 0) {
      return {
        error: 'Could not find a suitable STONEWALL structure',
        fee: 0,
        inputs: [],
        outputs: []
      }
    }
    if (changeValue >= minChange) {
      changeOutputs.push({
        scriptType: options.changeScriptType,
        type: 'change',
        value: changeValue
      })
    }
  }

  const fakeMixOutputs: StonewallOutput[] = []
  for (let i = 1; i < numSets; i += 1) {
    fakeMixOutputs.push({
      scriptType: options.recipientScriptType,
      type: 'fakeMix',
      value: target
    })
  }

  const recipientOutput: StonewallOutput = {
    scriptType: options.recipientScriptType,
    type: 'recipient',
    value: target
  }

  const outputs: StonewallOutput[] = [
    recipientOutput,
    ...fakeMixOutputs,
    ...changeOutputs
  ]

  const totalInputValue = sets.reduce((sum, set) => sum + sumValue(set), 0)
  const totalOutputValue = outputs.reduce(
    (sum, output) => sum + output.value,
    0
  )

  return {
    fee: totalInputValue - totalOutputValue,
    inputs: allInputs,
    outputs
  }
}

function resolveOptions(
  feeRate: number,
  options?: Partial<UtxoSelectionOptions>
): UtxoSelectionOptions {
  const longTermFeeRate =
    options?.longTermFeeRate ?? Math.min(feeRate, DEFAULT_LONG_TERM_FEE_RATE)
  return {
    addresses: options?.addresses,
    changeScriptType: options?.changeScriptType ?? DEFAULT_CHANGE_SCRIPT_TYPE,
    dustThreshold: options?.dustThreshold ?? DUST_LIMIT,
    feeFn: options?.feeFn,
    longTermFeeRate,
    outputs: options?.outputs ?? [],
    recipientScriptType:
      options?.recipientScriptType ?? DEFAULT_RECIPIENT_SCRIPT_TYPE,
    seed: options?.seed ?? Math.floor(randomNum() * SELECTION_SEED_MAX)
  }
}

function mapStonewallChangeOutputs(
  changeValues: number[],
  changeAddresses: string[]
): StonewallChangeOutput[] {
  const count = Math.min(changeValues.length, changeAddresses.length)
  const outputs: StonewallChangeOutput[] = []

  for (let index = 0; index < count; index += 1) {
    outputs.push({
      amount: changeValues[index],
      to: changeAddresses[index]
    })
  }

  return outputs
}

function selectUtxos(
  utxos: Utxo[],
  targetAmount: number,
  feeRate: number,
  strategy: SelectionStrategy,
  options?: Partial<UtxoSelectionOptions>
): SelectionResult {
  const opts = resolveOptions(feeRate, options)

  const totalAvailable = utxos.reduce((sum, utxo) => sum + utxo.value, 0)
  if (totalAvailable < targetAmount) {
    return { change: 0, error: 'Insufficient funds', fee: 0, inputs: [] }
  }

  const groups = buildOutputGroups(utxos, feeRate, opts.longTermFeeRate)
  const noInputsFee = getNoInputsFee(
    opts.outputs,
    feeRate,
    opts.recipientScriptType,
    opts.changeScriptType
  )
  const costOfChange = getCostOfChange(
    feeRate,
    opts.longTermFeeRate,
    opts.changeScriptType
  )
  const random = seededRandom(opts.seed)

  let selected =
    strategy === 'efficiency'
      ? selectBranchAndBound(targetAmount, groups, noInputsFee, costOfChange)
      : null

  if (!selected) {
    selected = selectKnapsack(targetAmount, groups, noInputsFee, random)
  }
  if (!selected) {
    selected = selectAccumulative(targetAmount, groups, noInputsFee)
  }
  if (!selected || selected.length === 0) {
    return { change: 0, error: 'Insufficient funds', fee: 0, inputs: [] }
  }

  return buildSingleSetResult(
    selected,
    targetAmount,
    feeRate,
    costOfChange,
    opts
  )
}

function selectEfficientUtxos(
  utxos: Utxo[],
  targetAmount: number,
  feeRate: number,
  options?: Partial<UtxoSelectionOptions>
): SelectionResult {
  return selectUtxos(utxos, targetAmount, feeRate, 'efficiency', options)
}

/**
 * Builds a STONEWALL transaction structure: two independent input sets, the
 * recipient output, a fake-mix output to self per extra set, and one change
 * output per set. Returns an error when the UTXOs cannot form the structure.
 */
function selectStonewallUtxos(
  utxos: Utxo[],
  targetAmount: number,
  feeRate: number,
  options?: Partial<UtxoSelectionOptions>
): StonewallResult {
  const opts = resolveOptions(feeRate, {
    ...options,
    seed: options?.seed ?? STONEWALL_SELECTION_SEED
  })

  const orderedUtxos = sortUtxosForSparrowSelection(utxos, opts.addresses)
  const totalAvailable = orderedUtxos.reduce((sum, utxo) => sum + utxo.value, 0)
  if (totalAvailable < targetAmount) {
    return { error: 'Insufficient funds', fee: 0, inputs: [], outputs: [] }
  }

  const groups = buildOutputGroups(orderedUtxos, feeRate, opts.longTermFeeRate)
  const noInputsFee = getNoInputsFee(
    opts.outputs,
    feeRate,
    opts.recipientScriptType,
    opts.changeScriptType
  )
  const random = javaSeededRandom(opts.seed)

  const sets = selectStonewallSets(
    targetAmount,
    groups,
    noInputsFee,
    opts.recipientScriptType,
    random
  )
  if (!sets) {
    return {
      error: 'Could not find a suitable STONEWALL structure',
      fee: 0,
      inputs: [],
      outputs: []
    }
  }

  return buildStonewallResult(sets, targetAmount, feeRate, opts)
}

export {
  getUtxoOutpoint,
  mapStonewallChangeOutputs,
  selectEfficientUtxos,
  selectStonewallUtxos,
  selectUtxos,
  sortUtxosForSparrowSelection
}
export type {
  SelectionResult,
  SelectionStrategy,
  StonewallChangeOutput,
  StonewallOutput,
  StonewallResult,
  UtxoSelectionOptions
}
