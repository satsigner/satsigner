import { useRouter } from 'expo-router'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'

type UseNostrShareTransactionParams = {
  account: Account | undefined
  id: string
}

/**
 * Returns a handler that hands a PSBT (base64) to the account's nostr devices
 * group chat. The handler returns the i18n key of the reason it could not
 * share (auto-sync disabled, no PSBT), or null once it navigated.
 */
export function useNostrShareTransaction({
  account,
  id
}: UseNostrShareTransactionParams) {
  const router = useRouter()
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  function shareTransaction(psbtBase64: string | undefined) {
    if (!account?.nostr?.autoSync) {
      return 'account.nostrSync.autoSyncMustBeEnabled'
    }
    if (!psbtBase64) {
      return 'account.nostrSync.transactionDataNotAvailable'
    }
    setTransactionToShare({
      transaction: psbtBase64,
      transactionData: { combinedPsbt: psbtBase64 }
    })
    router.push({
      params: { id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
    return null
  }

  return shareTransaction
}
