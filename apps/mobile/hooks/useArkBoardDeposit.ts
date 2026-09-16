import { type Href, useRouter } from 'expo-router'

import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type ArkAccount } from '@/types/models/Ark'
import { resolveArkBoardFundDestination } from '@/utils/arkBoardDeposit'

import { autoSelectUtxos } from './useContentProcessor'

function linkedSignTransactionHref(accountId: string): Href {
  return `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
}

function linkedIoPreviewHref(accountId: string): Href {
  return `/signer/bitcoin/account/${accountId}/signAndSend/ioPreview?autoSelectFromUri=${AUTO_SELECT_FROM_URI_SEARCH_PARAM}`
}

/**
 * Funding the Ark board from the linked on-chain Bitcoin account:
 * prefills the transaction builder and hands the user over to sign-and-send.
 * Pass a deposit address for a normal send, or the live Payjoin URI so the
 * sender path negotiates BIP77 into the board funding output.
 */
export function useArkBoardDeposit(arkAccount: ArkAccount | undefined) {
  const router = useRouter()
  const linkedAccount = useAccountsStore((state) =>
    state.accounts.find(
      (account) => account.id === arkAccount?.bitcoinAccountId
    )
  )

  function fundFromLinkedAccount(
    destination: string,
    preferredAmountSats?: number
  ) {
    if (!linkedAccount) {
      return
    }
    const resolved = resolveArkBoardFundDestination(
      destination,
      preferredAmountSats
    )
    const label = resolved.payjoinUri
      ? t('ark.board.payjoinFundLabel')
      : t('ark.board.depositLabel')
    const store = useTransactionBuilderStore.getState()

    store.setAccountId(linkedAccount.id)
    store.clearTransaction()
    store.setAccountId(linkedAccount.id)
    store.addOutput({
      amount: resolved.amountSats,
      label,
      to: resolved.address
    })
    store.setPayjoinUri(resolved.payjoinUri)

    // Default coin-select is "user", so ioPreview will not pick UTXOs from the
    // URI flag. Select here so preview is not empty.
    autoSelectUtxos(linkedAccount, resolved.amountSats, {
      addInput: store.addInput,
      setFeeRate: store.setFeeRate
    })

    router.navigate(linkedIoPreviewHref(linkedAccount.id))
  }

  function resumeLinkedBroadcast() {
    if (!linkedAccount) {
      return
    }
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(linkedAccount.id)
    router.navigate(linkedSignTransactionHref(linkedAccount.id))
  }

  return { fundFromLinkedAccount, linkedAccount, resumeLinkedBroadcast }
}
