import { type Href, useRouter } from 'expo-router'

import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type ArkAccount } from '@/types/models/Ark'

function linkedSignTransactionHref(accountId: string): Href {
  return `/signer/bitcoin/account/${accountId}/signAndSend/signTransaction`
}

/**
 * Resumes a Payjoin board the linked on-chain account signed but has not
 * broadcast yet.
 */
export function useArkBoardDeposit(arkAccount: ArkAccount | undefined) {
  const router = useRouter()
  const linkedAccount = useAccountsStore((state) =>
    state.accounts.find(
      (account) => account.id === arkAccount?.bitcoinAccountId
    )
  )

  function resumeLinkedBroadcast() {
    if (!linkedAccount) {
      return
    }
    const store = useTransactionBuilderStore.getState()
    store.setAccountId(linkedAccount.id)
    router.navigate(linkedSignTransactionHref(linkedAccount.id))
  }

  return { linkedAccount, resumeLinkedBroadcast }
}
