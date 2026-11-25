import { useMutation } from '@tanstack/react-query'

import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { useAccountsStore } from '@/store/accounts'

/**
 * Brings the account up to date before a send: a quick check when the last
 * full check is recent enough, otherwise a sync. Joins a sync that is already
 * running instead of starting another. Resolves true once the account is
 * synced.
 */
function useAccountSendSyncCheck(accountId: string) {
  const wallet = useGetAccountWallet(accountId)
  const { syncAccountNow } = useSyncAccountWithWallet()

  async function check(): Promise<boolean> {
    const account = useAccountsStore
      .getState()
      .accounts.find(({ id }) => id === accountId)
    if (!account || !wallet) {
      return false
    }
    const updated = await syncAccountNow(account, wallet)
    if (!updated) {
      return false
    }
    useAccountsStore.getState().updateAccount(updated)
    return updated.syncStatus === 'synced'
  }

  const mutation = useMutation({ mutationFn: check })

  return {
    checkAccount: mutation.mutateAsync,
    isChecking: mutation.isPending
  }
}

export default useAccountSendSyncCheck
