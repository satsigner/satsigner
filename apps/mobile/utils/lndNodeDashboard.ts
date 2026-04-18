import { type LndCombinedTransaction } from '@/types/lndNodeDashboard'

export function mergeCombinedTransactions(
  txs: LndCombinedTransaction[]
): LndCombinedTransaction[] {
  return Array.from(new Map(txs.map((tx) => [tx.id, tx])).values()).toSorted(
    (a, b) => b.timestamp - a.timestamp
  )
}
