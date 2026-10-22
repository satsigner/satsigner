import {
  BIP125_REPLACEABLE_SEQUENCE_BELOW,
  DUST_LIMIT,
  INCREMENTAL_RELAY_FEE_RATE
} from '@/constants/btc'
import { type Address } from '@/types/models/Address'
import {
  type FeeReplacementActions,
  type FeeReplacementAssessment,
  type FeeReplacementDraftResult,
  type FeeReplacementOutput,
  type FeeReplacementPolicy,
  type PreviewReplacementFlags
} from '@/types/models/FeeReplacement'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/outpoint'
import { estimateTransactionSize } from '@/utils/transaction'

type SequenceInput = {
  sequence: number
}

type OwnedInputSource = {
  previousOutput: { txid: string; vout: number }
  value?: number
}

type ParentTransaction = Pick<Transaction, 'id' | 'vout'>

type FreshAddress = Pick<Address, 'address' | 'index' | 'keychain' | 'summary'>

const DEFAULT_FEE_RATE_FLOOR = 1

function transactionSignalsRbf(inputs: SequenceInput[]): boolean {
  return inputs.some(
    (input) => input.sequence < BIP125_REPLACEABLE_SEQUENCE_BELOW
  )
}

function isTransactionUnconfirmed(blockHeight?: number): boolean {
  return blockHeight === undefined || blockHeight <= 0
}

function getReplacementActions(
  assessment: FeeReplacementAssessment,
  policyType: FeeReplacementPolicy
): FeeReplacementActions {
  if (policyType === 'watchonly') {
    return { bump: false, cancel: false, cpfp: false }
  }
  return {
    bump: assessment.canBumpOrCancel,
    cancel: assessment.canBumpOrCancel,
    cpfp: assessment.canCpfp
  }
}

function getPreviewReplacementFlags(input: {
  rbf: boolean
  spendsUnconfirmedParent: boolean
}): PreviewReplacementFlags {
  return {
    showCpfp: input.spendsUnconfirmedParent,
    showRbf: input.rbf
  }
}

function spendsUnconfirmedParent(
  inputs: Pick<Utxo, 'txid'>[],
  transactions: Pick<Transaction, 'blockHeight' | 'id'>[]
): boolean {
  const heightById = new Map(
    transactions.map((tx) => [tx.id, tx.blockHeight] as const)
  )
  return inputs.some((input) => {
    if (!heightById.has(input.txid)) {
      return false
    }
    return isTransactionUnconfirmed(heightById.get(input.txid))
  })
}

function parseFeeRateFloor(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < DEFAULT_FEE_RATE_FLOOR) {
    return DEFAULT_FEE_RATE_FLOOR
  }
  return Math.ceil(parsed)
}

function pickFreshReceiveAddress(
  addresses: FreshAddress[]
): string | undefined {
  const external = addresses.filter(
    (address) => address.keychain === 'external' && address.address.trim()
  )
  const unused = external.filter(
    (address) => (address.summary?.transactions ?? 0) === 0
  )
  const pool = unused.length > 0 ? unused : external
  const sorted = pool.toSorted(
    (left, right) => (left.index ?? 0) - (right.index ?? 0)
  )
  return sorted[0]?.address
}

function minimumReplacementFee(
  originalFee: number,
  originalVsize: number,
  newVsize: number
): number {
  const byIncremental =
    originalFee + INCREMENTAL_RELAY_FEE_RATE * Math.max(newVsize, 1)
  const originalRate =
    originalVsize > 0 ? Math.floor(originalFee / originalVsize) : 0
  const byHigherRate = (originalRate + INCREMENTAL_RELAY_FEE_RATE) * newVsize
  return Math.max(byIncremental, byHigherRate, originalFee + 1)
}

function minimumChildFee(input: {
  childVsize: number
  parentFee: number
  parentVsize: number
  targetFeeRate: number
}): number {
  const packageVsize = input.parentVsize + input.childVsize
  const packageFee = Math.ceil(input.targetFeeRate * packageVsize)
  const fromPackage = packageFee - input.parentFee
  const relayFloor = INCREMENTAL_RELAY_FEE_RATE * Math.max(input.childVsize, 1)
  return Math.max(fromPackage, relayFloor, 1)
}

function estimateVsize(
  inputs: Utxo[],
  outputs: FeeReplacementOutput[]
): number {
  const sized: Output[] = outputs.map((output, index) => ({
    ...output,
    localId: String(index)
  }))
  return estimateTransactionSize(inputs, sized).vsize
}

function sumValues(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function draftResult(
  inputs: Utxo[],
  outputs: FeeReplacementOutput[],
  fee: number,
  feeRate: number
): FeeReplacementDraftResult {
  const amount = sumValues(outputs.map((output) => output.amount))
  if (amount < DUST_LIMIT || fee < 1) {
    return { ok: false, reason: 'insufficient' }
  }
  return {
    draft: {
      fee,
      feeRate,
      inputs,
      outputs,
      rbf: true
    },
    ok: true
  }
}

function resolveInputUtxo(
  vin: OwnedInputSource & { sequence?: number },
  transactions: ParentTransaction[],
  addresses: Pick<Address, 'address' | 'keychain'>[]
): Utxo | undefined {
  const parent = transactions.find((tx) => tx.id === vin.previousOutput.txid)
  const output = parent?.vout[vin.previousOutput.vout]
  const value = output?.value ?? vin.value
  const address = output?.address
  if (value === undefined || !address) {
    return undefined
  }
  const tracked = addresses.find((entry) => entry.address === address)
  return {
    addressTo: address,
    keychain: tracked?.keychain === 'internal' ? 'internal' : 'external',
    txid: vin.previousOutput.txid,
    value,
    vout: vin.previousOutput.vout
  }
}

function resolveReplacementInputs(
  vin: (OwnedInputSource & { sequence?: number })[],
  transactions: ParentTransaction[],
  addresses: Pick<Address, 'address' | 'keychain'>[]
): Utxo[] | undefined {
  const inputs: Utxo[] = []
  for (const entry of vin) {
    const utxo = resolveInputUtxo(entry, transactions, addresses)
    if (!utxo) {
      return undefined
    }
    inputs.push(utxo)
  }
  return inputs
}

function buildFeeBumpDraft(input: {
  changeAddress: string
  extraUtxos: Utxo[]
  internalAddresses: Set<string>
  originalFee: number
  originalVsize: number
  outputs: FeeReplacementOutput[]
  resolvedInputs: Utxo[]
  targetFeeRate: number
}): FeeReplacementDraftResult {
  if (!input.changeAddress) {
    return { ok: false, reason: 'no-destination' }
  }
  if (input.resolvedInputs.length === 0) {
    return { ok: false, reason: 'unresolved-inputs' }
  }

  const payments = input.outputs.filter(
    (output) => !input.internalAddresses.has(output.to)
  )

  const candidates: Utxo[][] = [input.resolvedInputs]
  const extras = input.extraUtxos.toSorted(
    (left, right) => left.value - right.value
  )
  for (const extra of extras) {
    candidates.push([...input.resolvedInputs, extra])
  }

  for (const inputs of candidates) {
    const sizedPayments: Output[] = payments.map((output, index) => ({
      ...output,
      localId: String(index)
    }))
    const { vsize } = estimateTransactionSize(inputs, sizedPayments, true)
    const floor = minimumReplacementFee(
      input.originalFee,
      input.originalVsize,
      vsize
    )
    const rated = Math.ceil(Math.max(input.targetFeeRate, 1) * vsize)
    const fee = Math.max(floor, rated)
    const changeAmount =
      sumValues(inputs.map((utxo) => utxo.value)) -
      sumValues(payments.map((output) => output.amount)) -
      fee
    if (changeAmount < DUST_LIMIT) {
      continue
    }
    return {
      draft: {
        fee,
        feeRate: Math.ceil(fee / vsize),
        inputs,
        outputs: payments,
        rbf: true
      },
      ok: true
    }
  }

  return { ok: false, reason: 'insufficient' }
}

function buildCancelToSelfDraft(input: {
  destination: string
  destinationLabel: string
  originalFee: number
  originalVsize: number
  resolvedInputs: Utxo[]
  targetFeeRate: number
}): FeeReplacementDraftResult {
  if (!input.destination) {
    return { ok: false, reason: 'no-destination' }
  }
  if (input.resolvedInputs.length === 0) {
    return { ok: false, reason: 'unresolved-inputs' }
  }
  const placeholder: FeeReplacementOutput[] = [
    {
      amount: 0,
      label: input.destinationLabel,
      to: input.destination
    }
  ]
  const vsize = estimateVsize(input.resolvedInputs, placeholder)
  const floor = minimumReplacementFee(
    input.originalFee,
    input.originalVsize,
    vsize
  )
  const fee = Math.max(
    floor,
    Math.ceil(Math.max(input.targetFeeRate, 1) * vsize)
  )
  const amount = sumValues(input.resolvedInputs.map((utxo) => utxo.value)) - fee
  return draftResult(
    input.resolvedInputs,
    [
      {
        amount,
        label: input.destinationLabel,
        to: input.destination
      }
    ],
    fee,
    Math.ceil(fee / vsize)
  )
}

function buildCpfpDraft(input: {
  destination: string
  destinationLabel: string
  parentFee: number
  parentVsize: number
  targetFeeRate: number
  utxo: Utxo
}): FeeReplacementDraftResult {
  if (!input.destination) {
    return { ok: false, reason: 'no-destination' }
  }
  const placeholder: FeeReplacementOutput[] = [
    {
      amount: 0,
      label: input.destinationLabel,
      to: input.destination
    }
  ]
  const childVsize = estimateVsize([input.utxo], placeholder)
  const fee = minimumChildFee({
    childVsize,
    parentFee: input.parentFee,
    parentVsize: input.parentVsize,
    targetFeeRate: Math.max(input.targetFeeRate, 1)
  })
  const amount = input.utxo.value - fee
  return draftResult(
    [input.utxo],
    [
      {
        amount,
        label: input.destinationLabel,
        to: input.destination
      }
    ],
    fee,
    Math.ceil(fee / childVsize)
  )
}

function ownedOutputIndexes(
  txid: string,
  outputs: { address: string }[],
  unspentOutpoints: Set<string>
): number[] {
  const indexes: number[] = []
  for (let index = 0; index < outputs.length; index += 1) {
    if (unspentOutpoints.has(getUtxoOutpoint({ txid, vout: index }))) {
      indexes.push(index)
    }
  }
  return indexes
}

function assessAccountTransaction(input: {
  blockHeight?: number
  ownedOutpoints: Set<string>
  txid: string
  unspentOutpoints: Set<string>
  vin: (OwnedInputSource & SequenceInput)[]
  vout: { address: string }[]
}): FeeReplacementAssessment {
  const unconfirmed = isTransactionUnconfirmed(input.blockHeight)
  const signalsRbf = transactionSignalsRbf(input.vin)
  const allInputsOwned =
    input.vin.length > 0 &&
    input.vin.every((vin) =>
      input.ownedOutpoints.has(
        getUtxoOutpoint({
          txid: vin.previousOutput.txid,
          vout: vin.previousOutput.vout
        })
      )
    )
  const unspentIndexes = ownedOutputIndexes(
    input.txid,
    input.vout,
    input.unspentOutpoints
  )
  const hasUnspentOwnedOutput = unspentIndexes.length > 0
  return {
    allInputsOwned,
    canBumpOrCancel: unconfirmed && signalsRbf && allInputsOwned,
    canCpfp: unconfirmed && hasUnspentOwnedOutput,
    hasUnspentOwnedOutput,
    signalsRbf,
    unconfirmed
  }
}

export {
  assessAccountTransaction,
  buildCancelToSelfDraft,
  buildCpfpDraft,
  buildFeeBumpDraft,
  getPreviewReplacementFlags,
  getReplacementActions,
  minimumChildFee,
  minimumReplacementFee,
  parseFeeRateFloor,
  pickFreshReceiveAddress,
  resolveReplacementInputs,
  spendsUnconfirmedParent,
  transactionSignalsRbf
}
