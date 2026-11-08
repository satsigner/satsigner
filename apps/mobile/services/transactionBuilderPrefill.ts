import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { autoSelectUtxos } from '@/utils/contentProcessor'

type PrefillSendFromAccountParams = {
  account: Account
  address: string
  amountSats: number
  label: string
  // Must be an estimate for the account's own network.
  feeRateSatPerVb: number | null
}

/**
 * Starts a fresh transaction in the builder that pays one output from the
 * account, with coins already picked at the given fee rate.
 */
export function prefillSendFromAccount({
  account,
  address,
  amountSats,
  label,
  feeRateSatPerVb
}: PrefillSendFromAccountParams): void {
  // Send screens broadcast through the selected network's server, and an Ark
  // account, unlike the account list, does not switch the selected network.
  useBlockchainStore.getState().setSelectedNetwork(account.network)
  const store = useTransactionBuilderStore.getState()
  store.setAccountId(account.id)
  store.clearTransaction()
  store.setAccountId(account.id)
  store.addOutput({ amount: amountSats, label, to: address })
  autoSelectUtxos(account, amountSats, feeRateSatPerVb, {
    addInput: store.addInput,
    setFeeRate: store.setFeeRate
  })
}
