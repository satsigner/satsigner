import { useQueryClient } from '@tanstack/react-query'

import { releaseArkWallet } from '@/api/ark'
import { deleteArkLabelsByAccount } from '@/db/mutations/arkLabels'
import { forgetArkNotificationSubscription } from '@/services/arkNotificationSubscriptions'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import { deleteArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useArkExitClaimsStore } from '@/store/arkExitClaims'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { clearArkDerivedAddresses } from '@/utils/arkAddress'

export function useArkDeleteAccount() {
  const queryClient = useQueryClient()
  const removeAccount = useArkStore((state) => state.removeAccount)
  const removeAccountSwapJobs = useArkSwapsStore(
    (state) => state.removeAccountJobs
  )
  const removeAccountExitClaims = useArkExitClaimsStore(
    (state) => state.removeAccountData
  )

  async function deleteAccount(accountId: string): Promise<void> {
    const { accounts } = useArkStore.getState()
    const account = accounts.find((a) => a.id === accountId)

    const releaseWallet = () => {
      if (account) {
        releaseArkWallet(account.serverId, accountId)
      }
    }

    // The seed goes first: if that fails the account stays whole and the user
    // can retry, instead of a seed left behind that no account (and no wipe)
    // knows about. Right after, the account leaves every store so pollers stop
    // reopening it, and a wallet one of them reopened meanwhile is released.
    releaseWallet()
    await deleteArkMnemonic(accountId)
    removeAccount(accountId)
    removeAccountSwapJobs(accountId)
    removeAccountExitClaims(accountId)
    clearArkDerivedAddresses(accountId)
    forgetArkNotificationSubscription(accountId)
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === 'ark' && query.queryKey.includes(accountId)
    })
    releaseWallet()

    deleteArkLabelsByAccount(accountId)
    await deleteArkDatadir(accountId)
  }

  return { deleteAccount }
}
