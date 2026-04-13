import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type Label } from '@/utils/bip329'

import {
  accountKeys,
  addressKeys,
  labelKeys,
  transactionKeys,
  utxoKeys
} from '../keys'
import {
  cascadeAddrLabel,
  cascadeTxLabel,
  cascadeUtxoLabel,
  importLabels as importLabelsDb
} from '../mutations/labels'

function invalidateAccountData(
  queryClient: ReturnType<typeof useQueryClient>,
  accountId: string
) {
  queryClient.invalidateQueries({ queryKey: accountKeys.detail(accountId) })
  queryClient.invalidateQueries({
    queryKey: transactionKeys.all(accountId)
  })
  queryClient.invalidateQueries({ queryKey: utxoKeys.all(accountId) })
  queryClient.invalidateQueries({ queryKey: addressKeys.all(accountId) })
  queryClient.invalidateQueries({ queryKey: labelKeys.all(accountId) })
}

function useSetAddrLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      addr,
      label
    }: {
      accountId: string
      addr: string
      label: string
    }) => {
      cascadeAddrLabel(accountId, addr, label)
      return Promise.resolve()
    },
    onSuccess: (_, { accountId }) => {
      invalidateAccountData(queryClient, accountId)
    }
  })
}

function useSetTxLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      label,
      txid
    }: {
      accountId: string
      txid: string
      label: string
    }) => {
      cascadeTxLabel(accountId, txid, label)
      return Promise.resolve()
    },
    onSuccess: (_, { accountId }) => {
      invalidateAccountData(queryClient, accountId)
    }
  })
}

function useSetUtxoLabel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      label,
      txid,
      vout
    }: {
      accountId: string
      txid: string
      vout: number
      label: string
    }) => {
      cascadeUtxoLabel(accountId, txid, vout, label)
      return Promise.resolve()
    },
    onSuccess: (_, { accountId }) => {
      invalidateAccountData(queryClient, accountId)
    }
  })
}

function useImportLabels() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      accountId,
      labels
    }: {
      accountId: string
      labels: Label[]
    }) => {
      const count = importLabelsDb(accountId, labels)
      return Promise.resolve(count)
    },
    onSuccess: (_, { accountId }) => {
      invalidateAccountData(queryClient, accountId)
    }
  })
}

export { useImportLabels, useSetAddrLabel, useSetTxLabel, useSetUtxoLabel }
