import { useQuery } from '@tanstack/react-query'

import { transactionKeys } from '../keys'
import {
  getTransactionById,
  getTransactionsByAccount
} from '../queries/transactions'

function useTransactionsQuery(accountId: string) {
  return useQuery({
    queryFn: () => getTransactionsByAccount(accountId),
    queryKey: transactionKeys.all(accountId),
    staleTime: Infinity
  })
}

function useTransactionQuery(accountId: string, txid: string) {
  return useQuery({
    queryFn: () => getTransactionById(accountId, txid),
    queryKey: transactionKeys.detail(accountId, txid),
    staleTime: Infinity
  })
}

export { useTransactionQuery, useTransactionsQuery }
