/** ~2 weeks of blocks — safety buffer around birthday/checkpoint estimates. */
const RPC_SCAN_BUFFER_BLOCKS = 2016

/**
 * Estimate the block height for a wallet birthday by counting backwards from
 * the known current tip. More accurate than projecting from genesis because it
 * uses the real chain tip rather than an assumed average block time.
 * Falls back to 0 if no tip is available.
 */
function estimateBirthHeight(birthday: Date, currentTip: number): number {
  if (currentTip <= 0) {
    return 0
  }
  const MS_PER_BLOCK = 10 * 60 * 1000 // ~10 minutes
  const ageMs = Math.max(0, Date.now() - birthday.getTime())
  const blocksFromTip = Math.round(ageMs / MS_PER_BLOCK)
  return Math.max(0, currentTip - blocksFromTip - RPC_SCAN_BUFFER_BLOCKS)
}

/**
 * Approximate a calendar date for a block height using tip mediantime and the
 * usual ~10 minute block interval. Useful when the user enters a birthday as a
 * height and we still persist a Date on the account.
 */
function estimateDateFromHeight(
  height: number,
  currentTip: number,
  tipMediantimeSec = Math.floor(Date.now() / 1000)
): Date {
  const SECONDS_PER_BLOCK = 10 * 60
  const unix =
    tipMediantimeSec - Math.max(0, currentTip - Math.max(0, height)) * SECONDS_PER_BLOCK
  return new Date(Math.max(0, unix) * 1000)
}

/**
 * Resolve the block height where an RPC historical scan should begin.
 * Priority: explicit server floor → wallet birthday (tip-relative) →
 * BDK checkpoint → genesis (0).
 */
function computeRpcScanStartHeight(options: {
  birthdayDate?: Date
  checkpointHeight?: number
  currentTip: number
  rpcScanFromHeight?: number
}): number {
  const { birthdayDate, checkpointHeight, currentTip, rpcScanFromHeight } =
    options
  const tip = Math.max(0, currentTip)

  if (rpcScanFromHeight !== undefined) {
    return Math.min(Math.max(0, rpcScanFromHeight), tip || rpcScanFromHeight)
  }

  if (birthdayDate && tip > 0) {
    return Math.min(estimateBirthHeight(birthdayDate, tip), tip)
  }

  if (checkpointHeight !== undefined && checkpointHeight > 10_000) {
    return Math.min(
      Math.max(0, checkpointHeight - RPC_SCAN_BUFFER_BLOCKS),
      tip || checkpointHeight
    )
  }

  return 0
}

export {
  computeRpcScanStartHeight,
  estimateBirthHeight,
  estimateDateFromHeight,
  RPC_SCAN_BUFFER_BLOCKS
}
