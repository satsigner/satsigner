import type { Href } from 'expo-router'

import { UNSET_OUTPUT_AMOUNT_SATS } from '@/constants/btc'
import { startFreshTransaction } from '@/services/transactionBuilderPrefill'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { Account } from '@/types/models/Account'
import { matchAddressNetwork } from '@/utils/bitcoin'
import type { ChatBitcoinRequest } from '@/utils/chatPaymentRequests'
import {
  commitBitcoinUriToIoPreview,
  commitDustBitcoinUri,
  isDustPaymentAmount
} from '@/utils/contentProcessor'
import { hasPayjoinParam } from '@/utils/payjoinUri'

/**
 * Accounts that can pay a bitcoin request: the address is valid on their
 * network. Testnet and signet share address prefixes, so the request's parsed
 * network (always testnet for a tb1 address) can't tell them apart.
 */
export function getChatBitcoinPayAccounts(
  accounts: Account[],
  request: Pick<ChatBitcoinRequest, 'address'>
): Account[] {
  return accounts.filter(
    (account) =>
      matchAddressNetwork(request.address, account.network) === 'match'
  )
}

/**
 * Starts a new draft on the account paying the request and opens the
 * transaction preview, the same way a scanned bitcoin: URI does. Nothing is
 * signed or broadcast here; the preview asks the user to review it.
 */
export function startChatBitcoinRequestPay(
  account: Account,
  request: ChatBitcoinRequest,
  navigate: (href: Href) => void
): void {
  startFreshTransaction(account)
  const store = useTransactionBuilderStore.getState()

  const payjoinUri = hasPayjoinParam(request.uri) ? request.uri : undefined
  const paymentRequest = {
    address: request.address,
    amountSats: request.amountSats || UNSET_OUTPUT_AMOUNT_SATS,
    label: request.label
  }
  const actions = {
    addInput: store.addInput,
    addOutput: store.addOutput,
    navigate,
    setFeeRate: store.setFeeRate,
    setPayjoinUri: store.setPayjoinUri
  }
  const target = {
    account,
    accountId: account.id,
    nextBlockFee: useBlockchainStore.getState().nextBlockFee
  }

  if (isDustPaymentAmount(paymentRequest.amountSats)) {
    commitDustBitcoinUri(actions, target, paymentRequest, payjoinUri)
    return
  }
  commitBitcoinUriToIoPreview(actions, target, paymentRequest, payjoinUri)
}
