import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Network } from '@/types/settings/blockchain'
import {
  addSentTransactionToAccount,
  buildSentTransactionLabels,
  getSentOutputVouts,
  type SentTransaction
} from '@/utils/sentTransaction'

function readSentTransaction(txid: string, network: Network): SentTransaction {
  const builder = useTransactionBuilderStore.getState()
  return {
    fee: builder.fee,
    inputs: [...builder.inputs.values()],
    outputs: builder.outputs,
    rbf: builder.rbf,
    replacesTxid: builder.replacesTxid,
    signedTx: builder.signedTx,
    txid,
    vouts: getSentOutputVouts(builder.outputs, {
      network,
      psbtBase64: builder.psbt?.toBase64(),
      signedTxHex: builder.signedTx
    })
  }
}

function findAccount(accountId: string) {
  return useAccountsStore
    .getState()
    .accounts.find((entry) => entry.id === accountId)
}

function applySentTransaction(accountId: string, txid: string) {
  const account = findAccount(accountId)
  if (!account) {
    return
  }
  const sent = readSentTransaction(txid, account.network)
  const { importLabels, updateAccount } = useAccountsStore.getState()
  importLabels(accountId, buildSentTransactionLabels(sent))

  const labelledAccount = findAccount(accountId)
  const updatedAccount = labelledAccount
    ? addSentTransactionToAccount(labelledAccount, sent)
    : undefined
  if (updatedAccount) {
    updateAccount(updatedAccount)
  }
}

/**
 * Saves the labels of the transaction the builder just broadcast and shows it
 * in the account before the next sync. Call it before clearing the builder.
 */
export function recordSentTransaction(accountId: string, txid: string) {
  try {
    applySentTransaction(accountId, txid)
  } catch {
    // The broadcast already succeeded: labels and the optimistic entry are a
    // convenience, and the next sync brings the transaction in.
  }
}
