import { useQueryClient } from '@tanstack/react-query'

import { releaseArkWallet } from '@/api/ark'
import { useArkStore } from '@/store/ark'
import type { Network } from '@/types/settings/blockchain'

const INVALIDATED_QUERY_KINDS = ['wallet', 'balance', 'address'] as const

/**
 * Applies a new Ark server access token for the given network.
 *
 * Bark's `Config.serverAccessToken` is read only at `Wallet.create`/`open`
 * time — there is no runtime mutator. So any open wallet on that network
 * must be torn down and re-opened for the new token to take effect.
 */
export function useArkServerAccessToken() {
  const queryClient = useQueryClient()

  function applyAccessToken(network: Network, token: string): void {
    const normalized = token.trim()
    const store = useArkStore.getState()
    const current = store.serverAccessTokens[network] ?? ''
    if (normalized === current) {
      return
    }

    store.setServerAccessToken(network, normalized)

    const accounts = store.accounts.filter((a) => a.network === network)
    for (const account of accounts) {
      releaseArkWallet(account.serverId, account.id)
      for (const kind of INVALIDATED_QUERY_KINDS) {
        queryClient.invalidateQueries({
          queryKey: ['ark', kind, account.id]
        })
      }
    }
  }

  return { applyAccessToken }
}
