import { mainRed, warning, white } from '@/styles/colors'

/** Block node text spans this share of the node width. */
const BLOCK_TEXT_WIDTH_RATIO = 0.6
/** Extra layout width so amount + unit can paint past the sankey node band. */
const NODE_TEXT_OVERFLOW_WIDTH = 220

/**
 * Width used to lay out a sankey node paragraph. Non-block nodes never get
 * narrower than NODE_TEXT_OVERFLOW_WIDTH, so the amount and its unit stay on
 * one line instead of being truncated with an ellipsis.
 */
export function getNodeParagraphLayoutWidth(
  nodeWidth: number,
  paddingLeft: number,
  isBlock: boolean
) {
  if (isBlock) {
    return nodeWidth * BLOCK_TEXT_WIDTH_RATIO
  }
  return Math.max(nodeWidth - paddingLeft, NODE_TEXT_OVERFLOW_WIDTH)
}

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

export { NODE_TEXT_OVERFLOW_WIDTH, resolveChartOutputSpendStatus }
export type { ChartOutputSpendStatus }
