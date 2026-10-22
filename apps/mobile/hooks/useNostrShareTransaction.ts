import { useRouter } from 'expo-router'

import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'

export function useNostrShareTransaction(account: Account | undefined) {
  const router = useRouter()
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  function shareInDevicesGroupChat(
    psbtBase64OrSignedTxHex: string | undefined
  ) {
    if (!account?.nostr?.autoSync) {
      return { errorKey: 'account.nostrSync.autoSyncMustBeEnabled' }
    }
    if (!psbtBase64OrSignedTxHex) {
      return { errorKey: 'account.nostrSync.transactionDataNotAvailable' }
    }
    setTransactionToShare({
      transaction: psbtBase64OrSignedTxHex,
      transactionData: { combinedPsbt: psbtBase64OrSignedTxHex }
    })
    router.push({
      params: { id: account.id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
    return { errorKey: null }
  }

  return shareInDevicesGroupChat
}
