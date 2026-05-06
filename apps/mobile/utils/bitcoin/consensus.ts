import { SATS_PER_BITCOIN } from '@/constants/btc'

export const HALVING_INTERVAL = 210_000
export const DIFFICULTY_ADJUSTMENT_INTERVAL = 2016
export const TARGET_BLOCK_TIME_SECONDS = 600
export const INITIAL_SUBSIDY_SATS = 50 * SATS_PER_BITCOIN
export const MAX_SUPPLY_SATS = 21_000_000 * SATS_PER_BITCOIN

export type HistoricalHalving = {
  epoch: number
  height: number
  subsidySats: number
}

export function halvingEpoch(height: number): number {
  return Math.floor(height / HALVING_INTERVAL)
}

export function blockSubsidySats(height: number): number {
  const epoch = halvingEpoch(height)
  return Math.floor(INITIAL_SUBSIDY_SATS / 2 ** epoch)
}

export function nextHalvingHeight(height: number): number {
  const epoch = halvingEpoch(height)
  return (epoch + 1) * HALVING_INTERVAL
}

export function blocksUntilHalving(height: number): number {
  return nextHalvingHeight(height) - height
}

export function estimatedHalvingDate(height: number): Date {
  const remaining = blocksUntilHalving(height)
  const nowMs = Date.now()
  return new Date(nowMs + remaining * TARGET_BLOCK_TIME_SECONDS * 1000)
}

export function totalMinedSats(height: number): number {
  const currentEpoch = halvingEpoch(height)
  let total = 0

  for (let epoch = 0; epoch < currentEpoch; epoch += 1) {
    const subsidyPerBlock = Math.floor(INITIAL_SUBSIDY_SATS / 2 ** epoch)
    total += subsidyPerBlock * HALVING_INTERVAL
  }

  const subsidyThisEpoch = Math.floor(INITIAL_SUBSIDY_SATS / 2 ** currentEpoch)
  const blocksThisEpoch = height - currentEpoch * HALVING_INTERVAL + 1
  total += subsidyThisEpoch * blocksThisEpoch

  return total
}

export function percentIssued(height: number): number {
  return (totalMinedSats(height) / MAX_SUPPLY_SATS) * 100
}

export function difficultyEpoch(height: number): number {
  return Math.floor(height / DIFFICULTY_ADJUSTMENT_INTERVAL)
}

export function blocksUntilDifficultyAdjustment(height: number): number {
  const epoch = difficultyEpoch(height)
  const nextRetarget = (epoch + 1) * DIFFICULTY_ADJUSTMENT_INTERVAL
  return nextRetarget - height
}

export function estimatedDifficultyAdjustmentDate(height: number): Date {
  const remaining = blocksUntilDifficultyAdjustment(height)
  const nowMs = Date.now()
  return new Date(nowMs + remaining * TARGET_BLOCK_TIME_SECONDS * 1000)
}

/**
 * Estimate network hash rate from difficulty.
 * Formula: difficulty * 2^32 / TARGET_BLOCK_TIME_SECONDS hashes/sec
 */
export function estimatedHashRateEHs(difficulty: number): number {
  const hashesPerSecond = (difficulty * 2 ** 32) / TARGET_BLOCK_TIME_SECONDS
  return hashesPerSecond / 1e18
}

/**
 * Static historical halvings based on consensus rules and known timestamps.
 * The first two (epochs 0 and 1) were before height-based calculation was relevant.
 */
export function historicalHalvings(): HistoricalHalving[] {
  const halvings: HistoricalHalving[] = []
  let epoch = 0
  while (true) {
    const subsidySats = Math.floor(INITIAL_SUBSIDY_SATS / 2 ** epoch)
    if (subsidySats === 0) {
      break
    }
    halvings.push({
      epoch,
      height: epoch * HALVING_INTERVAL,
      subsidySats
    })
    epoch += 1
  }
  return halvings
}
