import type { MemPoolBlock, MemPoolFees } from '@/types/models/Blockchain'

/** Virtual-size capacity of a standard block (weight ÷ 4). */
export const MAX_BLOCK_VBYTES = 1_000_000

/** Cap projected buckets so a huge mempool stays usable in the UI. */
const MAX_PROJECTED_BLOCKS = 24

export type FeeHistogramBand = [feeRate: number, vsize: number]

/** Normalize raw Electrum/Esplora fee-histogram payloads into [feeRate, vsize] bands. */
export function normalizeHistogram(raw: unknown): FeeHistogramBand[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const bands: FeeHistogramBand[] = []
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length < 2) {
      continue
    }
    const feeRate = Number(entry[0])
    const vsize = Number(entry[1])
    if (!Number.isFinite(feeRate) || !Number.isFinite(vsize) || vsize <= 0) {
      continue
    }
    bands.push([feeRate, vsize])
  }
  return bands
}

/**
 * Pack a fee histogram into ~1 MvB buckets (highest fee first).
 * Approximate — ignores CPFP / ancestor fee rates that mempool.space models.
 */
export function projectedBlocksFromHistogram(
  histogram: FeeHistogramBand[]
): MemPoolBlock[] {
  if (histogram.length === 0) {
    return []
  }

  const bands = histogram
    .filter(([, vsize]) => vsize > 0 && Number.isFinite(vsize))
    .toSorted((a, b) => b[0] - a[0])

  if (bands.length === 0) {
    return []
  }

  const blocks: MemPoolBlock[] = []
  let bandIndex = 0
  let bandConsumed = 0

  while (blocks.length < MAX_PROJECTED_BLOCKS && bandIndex < bands.length) {
    let filled = 0
    let minFee = Number.POSITIVE_INFINITY
    let maxFee = 0
    let totalFees = 0

    while (filled < MAX_BLOCK_VBYTES && bandIndex < bands.length) {
      const [feeRate, bandVsize] = bands[bandIndex]
      const available = bandVsize - bandConsumed
      const take = Math.min(available, MAX_BLOCK_VBYTES - filled)
      if (take <= 0) {
        bandIndex += 1
        bandConsumed = 0
        continue
      }

      filled += take
      minFee = Math.min(minFee, feeRate)
      maxFee = Math.max(maxFee, feeRate)
      totalFees += take * feeRate
      bandConsumed += take

      if (bandConsumed >= bandVsize) {
        bandIndex += 1
        bandConsumed = 0
      }
    }

    if (filled <= 0 || !Number.isFinite(minFee)) {
      break
    }

    const entryFee = minFee
    const topFee = maxFee
    // Size-weighted average — NOT (min+max)/2. Electrum histograms use
    // power-of-2 fee bins; a tiny 16384 sat/vB outlier + bulk at 1 sat/vB
    // made the midpoint ~8192 and blew up send fees (feeRate × vsize).
    const medianFee = filled > 0 ? totalFees / filled : entryFee
    blocks.push({
      blockSize: Math.round(filled * 4),
      blockVSize: Math.round(filled),
      feeRange: [entryFee, topFee],
      medianFee,
      nTx: 0,
      totalFees: Math.round(totalFees)
    })

    if (filled < MAX_BLOCK_VBYTES) {
      break
    }
  }

  return blocks
}

/** Derive simple fee tiers from histogram-projected blocks. */
export function feesFromProjectedBlocks(
  blocks: MemPoolBlock[],
  minFeeRate?: number | null
): MemPoolFees | null {
  if (blocks.length === 0) {
    return null
  }

  const minimum = Math.max(1, Math.round(minFeeRate ?? 1))
  const [first, second, third] = blocks
  // Entry fee (bottom of the projected block) is what you must pay to be
  // included in that ~1 MvB slice — not the min/max midpoint or the top
  // outlier bin.
  function tierRate(block: MemPoolBlock | undefined): number {
    if (!block) {
      return minimum
    }
    const [entry] = block.feeRange
    return Math.max(minimum, Math.round(entry))
  }

  const high = tierRate(first)
  const medium = tierRate(second ?? first)
  const low = tierRate(third ?? second ?? first)

  return {
    high: Math.max(high, medium, low, minimum),
    low: Math.max(low, minimum),
    medium: Math.max(medium, low, minimum),
    none: minimum
  }
}
