import type { MemPoolFees } from '@/types/models/Blockchain'

const SATS_PER_BTC = 1e8
const VBYTES_PER_KB = 1000
const FEE_MEDIUM_RATIO = 0.75
const FEE_LOW_RATIO = 0.5
const FEE_NONE_SAT_PER_VB = 1

/** Convert Bitcoin Core `estimatesmartfee` BTC/kB rate into explorer fee tiers. */
export function feesFromBtcPerKb(feerateBtcPerKb: number): MemPoolFees {
  const satPerVb = Math.round((feerateBtcPerKb * SATS_PER_BTC) / VBYTES_PER_KB)
  return {
    high: satPerVb,
    low: Math.max(FEE_NONE_SAT_PER_VB, Math.round(satPerVb * FEE_LOW_RATIO)),
    medium: Math.round(satPerVb * FEE_MEDIUM_RATIO),
    none: FEE_NONE_SAT_PER_VB
  }
}
