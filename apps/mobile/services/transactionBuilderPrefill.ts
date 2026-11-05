import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { autoSelectUtxos } from '@/utils/contentProcessor'

type PrefillSendFromAccountParams = {
  account: Account
  address: string
  amountSats: number
  label: string
}

/**
 * Starts a fresh transaction in the builder that pays one output from the
 * account, with coins already picked at the next-block fee rate.
 */
export function prefillSendFromAccount({
  account,
  address,
  amountSats,
  label
}: PrefillSendFromAccountParams): void {
  const store = useTransactionBuilderStore.getState()
  store.setAccountId(account.id)
  store.clearTransaction()
  store.setAccountId(account.id)
  store.addOutput({ amount: amountSats, label, to: address })
  autoSelectUtxos(
    account,
    amountSats,
    useBlockchainStore.getState().nextBlockFee,
    { addInput: store.addInput, setFeeRate: store.setFeeRate }
  )
}
