import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import {
  addSentTransactionToAccount,
  buildSentTransactionLabels,
  type SentTransaction
} from '@/utils/sentTransaction'

function readSentTransaction(txid: string): SentTransaction {
  const builder = useTransactionBuilderStore.getState()
  return {
    fee: builder.fee,
    inputs: [...builder.inputs.values()],
    outputs: builder.outputs,
    rbf: builder.rbf,
    replacesTxid: builder.replacesTxid,
    signedTx: builder.signedTx,
    txid
  }
}

function applySentTransaction(accountId: string, sent: SentTransaction) {
  const accounts = useAccountsStore.getState()
  accounts.importLabels(accountId, buildSentTransactionLabels(sent))

  const account = useAccountsStore
    .getState()
    .accounts.find((entry) => entry.id === accountId)
  if (!account) {
    return
  }
  const updatedAccount = addSentTransactionToAccount(account, sent)
  if (updatedAccount) {
    accounts.updateAccount(updatedAccount)
  }
}

/**
 * Saves the labels of the transaction the builder just broadcast and shows it
 * in the account before the next sync. Call it before clearing the builder.
 */
export function recordSentTransaction(accountId: string, txid: string) {
  const sent = readSentTransaction(txid)
  try {
    applySentTransaction(accountId, sent)
  } catch {
    // The broadcast already succeeded: labels and the optimistic entry are a
    // convenience, and the next sync brings the transaction in.
  }
}
