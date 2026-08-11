import type { QueryClient } from '@tanstack/react-query'

import { syncArkWallet } from '@/api/ark'
import { useArkStore } from '@/store/ark'

export function invalidateArkAccountQueries(
  queryClient: QueryClient,
  accountId: string
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['ark', 'balance', accountId] }),
    queryClient.invalidateQueries({
      queryKey: ['ark', 'movements', accountId]
    }),
    queryClient.invalidateQueries({ queryKey: ['ark', 'vtxos', accountId] })
  ]).then(() => undefined)
}

export async function syncArkAccountAndInvalidate(
  queryClient: QueryClient,
  accountId: string
): Promise<void> {
  const { accounts } = useArkStore.getState()
  const account = accounts.find((a) => a.id === accountId)
  if (account) {
    try {
      await syncArkWallet(account.serverId, accountId)
    } catch {
      // a failed sync must not block refetching cached data
    }
  }
  try {
    await invalidateArkAccountQueries(queryClient, accountId)
  } catch {
    // callers fire this without awaiting; a rejection must never go unhandled
  }
}
