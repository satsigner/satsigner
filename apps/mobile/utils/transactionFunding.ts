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
