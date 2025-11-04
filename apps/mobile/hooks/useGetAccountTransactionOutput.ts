import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { formatTxOutputToUtxo } from '@/utils/format'

function useGetAccountTransactionOutput(
  accountId: Account['id'],
  txid: Transaction['id'],
  vout: number
) {
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === accountId)
  )

  const outputRef = `${txid}:${vout}`
  const tx = account?.transactions.find((tx) => tx.id === txid)
  const outputFromUtxos = account?.utxos.find(
    (utxo) => utxo.txid === txid && utxo.vout === vout
  )
  const outputFromTx = formatTxOutputToUtxo(tx, vout)
  const outputLabel = account?.labels[outputRef]?.label
  const output = outputFromUtxos ? { ...outputFromUtxos } : outputFromTx

  if (outputLabel && output) {
    output.label = outputLabel
  }

  if (!outputLabel && output && output.addressTo) {
    output.label = account?.labels[output.addressTo]?.label
  }

  if (output && !output.label) {
    output.label = ''
  }

  return output
}

export default useGetAccountTransactionOutput
