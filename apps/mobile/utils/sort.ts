import { type Direction } from '@/types/logic/sort'
import { type Address } from '@/types/models/Address'
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

function getTimeKey(transaction: Transaction) {
  return transaction.timestamp === undefined
    ? undefined
    : new Date(transaction.timestamp).getTime()
}

/**
 * Length of the chain of listed transactions with the same timestamp that a
 * transaction spends from. Transactions of one block share a timestamp, so
 * this keeps a parent before the child that spends it.
 */
function getSameTimeSpendDepths(transactions: Transaction[]) {
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction])
  )
  const depths = new Map<string, number>()

  function getDepth(transaction: Transaction, path: Set<string>): number {
    const knownDepth = depths.get(transaction.id)
    if (knownDepth !== undefined) {
      return knownDepth
    }
    const nextPath = new Set(path).add(transaction.id)
    const parentDepths = transaction.vin.flatMap((input) => {
      const parent = transactionsById.get(input.previousOutput.txid)
      if (
        !parent ||
        nextPath.has(parent.id) ||
        getTimeKey(parent) !== getTimeKey(transaction)
      ) {
        return []
      }
      return [getDepth(parent, nextPath) + 1]
    })
    const depth = Math.max(0, ...parentDepths)
    depths.set(transaction.id, depth)
    return depth
  }

  for (const transaction of transactions) {
    getDepth(transaction, new Set())
  }
  return depths
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
  const spendDepths =
    sortField === 'date' ? getSameTimeSpendDepths(transactions) : undefined

  // Same-time ties go parent before child, then by id, so desc is the exact
  // reverse of asc.
  function compareSameTime(
    transaction1: Transaction,
    transaction2: Transaction
  ) {
    const depthDiff =
      (spendDepths?.get(transaction1.id) ?? 0) -
      (spendDepths?.get(transaction2.id) ?? 0)
    return (depthDiff || transaction1.id.localeCompare(transaction2.id)) * sign
  }

  return transactions.toSorted((transaction1, transaction2) => {
    if (sortField === 'date') {
      const has1 = transaction1.timestamp !== undefined
      const has2 = transaction2.timestamp !== undefined
      if (!has1 && !has2) {
        return compareSameTime(transaction1, transaction2)
      }
      // Unconfirmed / missing timestamps stay at the top when newest-first,
      // and at the bottom when oldest-first.
      if (!has1) {
        return sortDirection === 'desc' ? -1 : 1
      }
      if (!has2) {
        return sortDirection === 'desc' ? 1 : -1
      }
      const byTime = compareTimestamp(
        transaction1.timestamp,
        transaction2.timestamp
      )
      return byTime
        ? byTime * sign
        : compareSameTime(transaction1, transaction2)
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

function sortAddressesByIndex(addresses: Address[], sortDirection: Direction) {
  const sign = sortDirection === 'asc' ? 1 : -1
  return addresses.toSorted(
    (address1, address2) =>
      ((address1.index ?? 0) - (address2.index ?? 0)) * sign
  )
}

export {
  compareAmount,
  compareLabel,
  compareTimestamp,
  sortAddressesByIndex,
  sortTransactions
}
export type { TransactionSortField }
