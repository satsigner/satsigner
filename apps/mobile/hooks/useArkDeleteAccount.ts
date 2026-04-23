import { useQueryClient } from '@tanstack/react-query'

import { releaseArkWallet } from '@/api/ark'
import { deleteArkDatadir } from '@/storage/arkDatadir'
import { deleteArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'

const INVALIDATED_QUERY_KINDS = ['wallet', 'balance', 'address'] as const

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
    removeAccount(accountId)

    for (const kind of INVALIDATED_QUERY_KINDS) {
      queryClient.removeQueries({ queryKey: ['ark', kind, accountId] })
    }
  }

  return { deleteAccount }
}
