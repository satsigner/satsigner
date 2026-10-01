import { useRouter } from 'expo-router'
import { toast } from 'sonner-native'

import { t } from '@/locales'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'

/**
 * Returns a handler that hands a PSBT (base64) to the account's nostr devices
 * group chat. Requires nostr auto-sync to be enabled on the account.
 */
export function useNostrShareTransaction({
  account,
  id
}: {
  account: Account | undefined
  id: string
}) {
  const router = useRouter()
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )

  return (psbtBase64: string | undefined) => {
    if (!account?.nostr?.autoSync) {
      toast.error(t('account.nostrSync.autoSyncMustBeEnabled'))
      return
    }
    if (!psbtBase64) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }
    setTransactionToShare({
      transaction: psbtBase64,
      transactionData: { combinedPsbt: psbtBase64 }
    })
    router.push({
      params: { id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
  }
}
