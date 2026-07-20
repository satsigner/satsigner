import type { MemPoolFees } from '@/types/models/Blockchain'

const SATS_PER_BTC = 1e8
const VBYTES_PER_KB = 1000
const FEE_MEDIUM_RATIO = 0.75
const FEE_LOW_RATIO = 0.5
const FEE_NONE_SAT_PER_VB = 1

/** Convert Bitcoin Core BTC/kB feerate to sat/vB. */
export function satPerVbFromBtcPerKb(feerateBtcPerKb: number): number {
  return Math.round((feerateBtcPerKb * SATS_PER_BTC) / VBYTES_PER_KB)
}

/** Convert Bitcoin Core `estimatesmartfee` BTC/kB rate into explorer fee tiers. */
export function feesFromBtcPerKb(feerateBtcPerKb: number): MemPoolFees {
  const satPerVb = satPerVbFromBtcPerKb(feerateBtcPerKb)
  return {
    high: satPerVb,
    low: Math.max(FEE_NONE_SAT_PER_VB, Math.round(satPerVb * FEE_LOW_RATIO)),
    medium: Math.round(satPerVb * FEE_MEDIUM_RATIO),
    none: FEE_NONE_SAT_PER_VB
  }
}

/**
 * Build fee tiers from separate Core confirmation targets when available.
 * Falls back to ratio-based medium/low when only the next-block estimate exists.
 */
export function feesFromSmartFeeTargets(params: {
  highBtcPerKb?: number | null
  lowBtcPerKb?: number | null
  mediumBtcPerKb?: number | null
  minBtcPerKb?: number | null
}): MemPoolFees | null {
  const high =
    params.highBtcPerKb !== null && params.highBtcPerKb !== undefined
      ? satPerVbFromBtcPerKb(params.highBtcPerKb)
      : null
  if (high === null) {
    return null
  }

  const medium =
    params.mediumBtcPerKb !== null && params.mediumBtcPerKb !== undefined
      ? satPerVbFromBtcPerKb(params.mediumBtcPerKb)
      : Math.round(high * FEE_MEDIUM_RATIO)
  const low =
    params.lowBtcPerKb !== null && params.lowBtcPerKb !== undefined
      ? satPerVbFromBtcPerKb(params.lowBtcPerKb)
      : Math.max(FEE_NONE_SAT_PER_VB, Math.round(high * FEE_LOW_RATIO))
  const none =
    params.minBtcPerKb !== null && params.minBtcPerKb !== undefined
      ? Math.max(FEE_NONE_SAT_PER_VB, satPerVbFromBtcPerKb(params.minBtcPerKb))
      : FEE_NONE_SAT_PER_VB

  return {
    high: Math.max(high, medium, low, none),
    low: Math.max(low, none),
    medium: Math.max(medium, low, none),
    none
  }
}
