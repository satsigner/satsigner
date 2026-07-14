import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { type Output } from '@/types/models/Output'
import { type Utxo } from '@/types/models/Utxo'
import { estimateTransactionSize } from '@/utils/transaction'

export function getTransactionRemainingBalance(
  totalInputSats: number,
  totalOutputSats: number,
  minerFeeSats: number
): number {
  return totalInputSats - totalOutputSats - minerFeeSats
}

export function isTransactionUnderfunded(
  totalInputSats: number,
  totalOutputSats: number,
  minerFeeSats: number
): boolean {
  return (
    getTransactionRemainingBalance(
      totalInputSats,
      totalOutputSats,
      minerFeeSats
    ) < 0
  )
}

export function getOutputMaxAllowedSats(params: {
  totalInputSats: number
  minerFeeSats: number
  outputAmountSats: number
  outputsTotalSats: number
}): number {
  const otherOutputsTotal = params.outputsTotalSats - params.outputAmountSats
  return Math.max(
    0,
    params.totalInputSats - params.minerFeeSats - otherOutputsTotal
  )
}

export function getCommittedTransactionOutputSats(
  paymentOutputSats: number,
  stonewallPreviewOutputSats: number[]
): number {
  return (
    paymentOutputSats +
    stonewallPreviewOutputSats.reduce((sum, amount) => sum + amount, 0)
  )
}

export function getFundingMinerFeeSats(params: {
  projectedMinerFeeSats: number
  stonewallMinerFeeSats?: number | null
}): number {
  if (
    typeof params.stonewallMinerFeeSats === 'number' &&
    !Number.isNaN(params.stonewallMinerFeeSats) &&
    params.stonewallMinerFeeSats >= 0
  ) {
    return params.stonewallMinerFeeSats
  }

  return params.projectedMinerFeeSats
}

export function getProjectedMinerFeeSats(params: {
  committedOutputSats: number
  feeRate: number
  fundingOutputs: Output[]
  inputs: Utxo[]
  totalInputSats: number
}): number {
  if (params.inputs.length === 0) {
    return 0
  }

  const { vsize: baseVsize } = estimateTransactionSize(
    params.inputs,
    params.fundingOutputs
  )
  const baseFee = Math.round(params.feeRate * baseVsize)
  const hasFundingChange =
    params.totalInputSats > params.committedOutputSats + baseFee
  const { vsize } = estimateTransactionSize(
    params.inputs,
    params.fundingOutputs,
    hasFundingChange
  )

  return Math.round(params.feeRate * vsize)
}

export function shouldDeferUnderfundedWarning(params: {
  defaultAutoSelectAlgorithm: AutoSelectUtxosAlgorithm
  inputsCount: number
  isAutoSelectPending: boolean
  isSelectingUtxos: boolean
  outputsCount: number
  selectedAlgorithm: AutoSelectUtxosAlgorithm
}): boolean {
  if (params.isSelectingUtxos) {
    return true
  }

  if (params.isAutoSelectPending && params.inputsCount === 0) {
    return true
  }

  if (params.outputsCount === 0 || params.inputsCount > 0) {
    return false
  }

  if (params.selectedAlgorithm !== 'user') {
    return true
  }

  return params.defaultAutoSelectAlgorithm !== 'user'
}
