import { type Direction } from '@/types/logic/sort'
import { type Transaction } from '@/types/models/Transaction'

function compareTimestamp(date1?: Date | string, date2?: Date | string) {
  if (!date1 || !date2) return 0
  return new Date(date1).getTime() - new Date(date2).getTime()
}

function compareAmount(amount1: number, amount2: number) {
  return amount1 - amount2
}

function sortTransactions(
  transactions: Transaction[],
  sortDirection: Direction
) {
  return transactions.sort((transaction1, transaction2) => {
    const result = compareTimestamp(
      transaction1.timestamp,
      transaction2.timestamp
    )
    const balance1 = transaction1.received - transaction1.sent
    const balance2 = transaction2.received - transaction2.sent
    if (result === 0) {
      if (transaction1.timestamp === undefined) {
        return 1
      } else if (transaction2.timestamp === undefined) {
        return -1
      }
      if (balance1 * balance2 < 0) {
        return balance1 > 0 ? -1 : 1
      }
      return 0
    }
    return sortDirection === 'asc' ? -result : result
  })
}

export { compareAmount, compareTimestamp, sortTransactions }
