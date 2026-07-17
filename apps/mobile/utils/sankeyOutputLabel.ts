import { mainRed, warning, white } from '@/styles/colors'

export function getUnspentOutputSatsColor(params: {
  value?: number
  maxAllowedSats?: number
  isChange: boolean
  isMiningFee: boolean
  isGreenOutput: boolean
}): string {
  const { value, maxAllowedSats, isChange, isMiningFee, isGreenOutput } = params

  if (
    !isChange &&
    !isMiningFee &&
    typeof value === 'number' &&
    typeof maxAllowedSats === 'number'
  ) {
    return value > maxAllowedSats ? warning : white
  }

  return isGreenOutput ? white : mainRed
}

type ChartOutputSpendStatus = 'unspent' | 'spent' | 'pending'

type LabelMap = Map<string, string> | Record<string, string>

/**
 * Resolve spent / unspent for Sankey outputs from local wallet data.
 *
 * Ground truth order:
 * 1. Still in the wallet UTXO set → unspent
 * 2. Wallet knows a spending tx for the outpoint → spent
 * 3. Otherwise → pending (show “?” until a node/network outspend check)
 */
function resolveChartOutputSpendStatus(params: {
  outpoint: string
  unspentOutpoints?: ReadonlySet<string>
  spendingTxIdsByOutpoint?: LabelMap
}): ChartOutputSpendStatus {
  const { outpoint, unspentOutpoints, spendingTxIdsByOutpoint } = params

  if (!unspentOutpoints) {
    return 'unspent'
  }

  if (unspentOutpoints.has(outpoint)) {
    return 'unspent'
  }

  const spendingTxId = getSpendingTxIdFromMap(spendingTxIdsByOutpoint, outpoint)
  if (spendingTxId) {
    return 'spent'
  }

  return 'pending'
}

function getSpendingTxIdFromMap(
  map: LabelMap | undefined,
  outpoint: string
): string | undefined {
  if (!map) {
    return undefined
  }
  const value = map instanceof Map ? map.get(outpoint) : map[outpoint]
  return value?.trim() || undefined
}

export { getSpendingTxIdFromMap, resolveChartOutputSpendStatus }
export type { ChartOutputSpendStatus }
