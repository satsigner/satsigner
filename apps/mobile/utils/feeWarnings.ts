export const HIGH_FEE_RATIO = 0.1
export const FEE_RATE_ELEVATED_MULTIPLIER = 2
const FEE_RATE_SLIDER_FLOOR = 128
const FEE_RATE_SLIDER_EXTENDED = 1024

export type FeePercentageParams = {
  minerFeeSats: number
  totalInputSats?: number
  totalOutputSats?: number
}

export function getTotalOutputValueSats(params: FeePercentageParams): number {
  const { minerFeeSats, totalInputSats, totalOutputSats } = params

  if (typeof totalOutputSats === 'number' && totalOutputSats > 0) {
    return totalOutputSats
  }

  if (
    typeof totalInputSats === 'number' &&
    totalInputSats > minerFeeSats &&
    totalInputSats > 0
  ) {
    return totalInputSats - minerFeeSats
  }

  return 0
}

/** Coldcard / Sparrow: fee as a fraction of total value out. */
export function getFeePercentage(params: FeePercentageParams): number {
  const totalOutputSats = getTotalOutputValueSats(params)

  if (params.minerFeeSats <= 0 || totalOutputSats <= 0) {
    return 0
  }

  return params.minerFeeSats / totalOutputSats
}

export function isHighMinerFee(params: FeePercentageParams): boolean {
  return getFeePercentage(params) >= HIGH_FEE_RATIO
}

export function getFeeRateSliderMax(
  nextBlockFee: number | null | undefined
): number {
  const recommended =
    typeof nextBlockFee === 'number' && nextBlockFee >= 1 ? nextBlockFee : 1

  return Math.max(FEE_RATE_SLIDER_FLOOR, Math.ceil(recommended * 4))
}

export function getFeeRateInputMax(
  nextBlockFee: number | null | undefined
): number {
  return Math.max(FEE_RATE_SLIDER_EXTENDED, getFeeRateSliderMax(nextBlockFee))
}

export function isElevatedFeeRate(
  feeRate: number,
  nextBlockFee: number | null | undefined
): boolean {
  if (feeRate <= 0) {
    return false
  }

  const recommended =
    typeof nextBlockFee === 'number' && nextBlockFee >= 1 ? nextBlockFee : null

  if (recommended === null) {
    return false
  }

  return feeRate >= recommended * FEE_RATE_ELEVATED_MULTIPLIER
}

export function shouldHighlightElevatedFeeRate(params: {
  deferWarning: boolean
  feeRate: number
  fundingMinerFeeSats: number
  inputsCount: number
  nextBlockFee: number | null | undefined
  totalInputSats: number
}): boolean {
  if (params.deferWarning || params.inputsCount === 0) {
    return false
  }

  if (
    isHighMinerFee({
      minerFeeSats: params.fundingMinerFeeSats,
      totalInputSats: params.totalInputSats
    })
  ) {
    return false
  }

  return isElevatedFeeRate(params.feeRate, params.nextBlockFee)
}

export function estimateTargetBlocks(
  feeRate: number,
  nextBlockFee: number | null | undefined
): number | undefined {
  if (feeRate < 1) {
    return undefined
  }

  const recommended =
    typeof nextBlockFee === 'number' && nextBlockFee >= 1 ? nextBlockFee : null

  if (recommended === null) {
    return undefined
  }

  if (feeRate >= recommended) {
    return 1
  }

  return Math.min(50, Math.max(2, Math.round(recommended / feeRate)))
}
