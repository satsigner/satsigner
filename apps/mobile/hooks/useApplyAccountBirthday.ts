import { toast } from 'sonner-native'

import useSyncAccountWithWallet, {
  cancelAccountSync,
  isAccountSyncing
} from '@/hooks/useSyncAccountWithWallet'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'

/**
 * Persist a wallet birthday and restart an RPC rescan when a wallet is loaded.
 */
function useApplyAccountBirthday() {
  const updateAccountBirthday = useAccountsStore(
    (state) => state.updateAccountBirthday
  )
  const wallets = useWalletsStore((state) => state.wallets)
  const { prioritizeSync, syncAccountWithWallet } = useSyncAccountWithWallet()

  async function applyBirthday(accountId: string, date: Date | undefined) {
    const account = useAccountsStore
      .getState()
      .accounts.find((a) => a.id === accountId)
    if (!account) {
      return false
    }

    const prevTime = account.birthdayDate?.getTime()
    const nextTime = date?.getTime()
    if (prevTime === nextTime) {
      return false
    }

    updateAccountBirthday(accountId, date)
    cancelAccountSync(accountId)

    const wallet = wallets[accountId]
    const latestAccount =
      useAccountsStore.getState().accounts.find((a) => a.id === accountId) ??
      account

    if (!wallet) {
      toast.success(t('account.birthdayDate.updatedRefresh'))
      return true
    }

    toast.success(t('account.birthdayDate.rescanQueued'))

    for (let i = 0; i < 60; i += 1) {
      if (!isAccountSyncing(accountId)) {
        break
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100)
      })
    }

    prioritizeSync(accountId)
    await syncAccountWithWallet(latestAccount, wallet, true, true)
    return true
  }

  return { applyBirthday }
}

export { useApplyAccountBirthday }
