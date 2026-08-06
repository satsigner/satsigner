import { type Direction } from '@/types/logic/sort'
import { type Transaction } from '@/types/models/Transaction'

type TransactionSortField = 'date' | 'amount' | 'label'

function compareTimestamp(date1?: Date | string, date2?: Date | string) {
  if (!date1 || !date2) {
    return 0
  }
  return new Date(date1).getTime() - new Date(date2).getTime()
}

function compareAmount(amount1: number, amount2: number) {
  return amount1 - amount2
}

function compareLabel(label1?: string, label2?: string) {
  const a = (label1 || '').trim()
  const b = (label2 || '').trim()
  if (!a && !b) {
    return 0
  }
  if (!a) {
    return 1
  }
  if (!b) {
    return -1
  }
  return a.localeCompare(b)
}

function transactionAmount(transaction: Transaction) {
  return Math.abs((transaction.received || 0) - (transaction.sent || 0))
}

/**
 * Sort transactions. Direction matches UTXO list: `desc` = newest / largest first.
 */
function sortTransactions(
  transactions: Transaction[],
  sortDirection: Direction,
  sortField: TransactionSortField = 'date'
) {
  const sign = sortDirection === 'asc' ? 1 : -1
  return transactions.toSorted((transaction1, transaction2) => {
    if (sortField === 'date') {
      const has1 = transaction1.timestamp !== undefined
      const has2 = transaction2.timestamp !== undefined
      if (!has1 && !has2) {
        return 0
      }
      // Unconfirmed / missing timestamps stay at the top when newest-first,
      // and at the bottom when oldest-first.
      if (!has1) {
        return sortDirection === 'desc' ? -1 : 1
      }
      if (!has2) {
        return sortDirection === 'desc' ? 1 : -1
      }
      return (
        compareTimestamp(transaction1.timestamp, transaction2.timestamp) * sign
      )
    }

    if (sortField === 'amount') {
      return (
        compareAmount(
          transactionAmount(transaction1),
          transactionAmount(transaction2)
        ) * sign
      )
    }

    return compareLabel(transaction1.label, transaction2.label) * sign
  })
}

export {
  compareAmount,
  compareLabel,
  compareTimestamp,
  sortTransactions,
  transactionAmount
}
export type { TransactionSortField }
