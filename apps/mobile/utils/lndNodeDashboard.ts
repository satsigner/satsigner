import { type LNDCombinedTransaction } from '@/types/models/Lightning'

export function mergeCombinedTransactions(
  txs: LNDCombinedTransaction[]
): LNDCombinedTransaction[] {
  return Array.from(new Map(txs.map((tx) => [tx.id, tx])).values()).toSorted(
    (a, b) => b.timestamp - a.timestamp
  )
}
