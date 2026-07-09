import { useQueryClient } from '@tanstack/react-query'

import { releaseArkWallet } from '@/api/ark'
import { deleteArkLabelsByAccount } from '@/db/mutations/arkLabels'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import { deleteArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { clearArkDerivedAddresses } from '@/utils/arkAddress'

export function useArkDeleteAccount() {
  const queryClient = useQueryClient()
  const removeAccount = useArkStore((state) => state.removeAccount)

  async function deleteAccount(accountId: string): Promise<void> {
    const { accounts } = useArkStore.getState()
    const account = accounts.find((a) => a.id === accountId)

    if (account) {
      releaseArkWallet(account.serverId, accountId)
    }

    await deleteArkMnemonic(accountId)
    await deleteArkDatadir(accountId)
    deleteArkLabelsByAccount(accountId)
    removeAccount(accountId)
    clearArkDerivedAddresses(accountId)

    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === 'ark' && query.queryKey.includes(accountId)
    })
  }

  return { deleteAccount }
}
