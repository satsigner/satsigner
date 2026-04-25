import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  type ArkMovementEvent,
  type ArkNotificationUnsubscribe,
  openArkWallet,
  subscribeArkNotifications
} from '@/api/ark'
import { getArkServer } from '@/constants/arkServers'
import { t } from '@/locales'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import type { ArkAccount } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'
import { formatNumber } from '@/utils/format'

type AccessTokenMap = Partial<Record<Network, string>>

const activeSubscriptions = new Map<string, ArkNotificationUnsubscribe>()
const inflightSubscriptions = new Set<string>()

function notifyReceive(account: ArkAccount, event: ArkMovementEvent) {
  if (event.type !== 'created' || event.effectiveBalanceSats <= 0) {
    return
  }
  toast.success(
    t('ark.notifications.received', {
      amount: formatNumber(event.effectiveBalanceSats),
      wallet: account.name
    })
  )
}

async function subscribeAccount(
  account: ArkAccount,
  accessToken: string | undefined,
  queryClient: QueryClient
): Promise<void> {
  if (
    activeSubscriptions.has(account.id) ||
    inflightSubscriptions.has(account.id)
  ) {
    return
  }
  inflightSubscriptions.add(account.id)
  try {
    const server = getArkServer(account.network, account.serverId)
    if (!server) {
      return
    }
    const mnemonic = await getArkMnemonic(account.id)
    if (!mnemonic) {
      return
    }
    const datadir = await ensureArkDatadir(account.id)
    await openArkWallet({
      accountId: account.id,
      datadir,
      mnemonic,
      server,
      serverAccessToken: accessToken
    })

    const accountStillExists = useArkStore
      .getState()
      .accounts.some((a) => a.id === account.id)
    if (!accountStillExists || activeSubscriptions.has(account.id)) {
      return
    }

    const unsubscribe = subscribeArkNotifications(
      account.serverId,
      account.id,
      (event) => {
        queryClient.invalidateQueries({
          queryKey: ['ark', 'balance', account.id]
        })
        queryClient.invalidateQueries({
          queryKey: ['ark', 'movements', account.id]
        })
        notifyReceive(account, event)
      }
    )
    activeSubscriptions.set(account.id, unsubscribe)
  } finally {
    inflightSubscriptions.delete(account.id)
  }
}

async function subscribeAccountSafe(
  account: ArkAccount,
  accessToken: string | undefined,
  queryClient: QueryClient
): Promise<void> {
  try {
    await subscribeAccount(account, accessToken, queryClient)
  } catch {
    inflightSubscriptions.delete(account.id)
  }
}

function syncSubscriptions(
  accounts: ArkAccount[],
  accessTokens: AccessTokenMap,
  queryClient: QueryClient
) {
  const desiredIds = new Set(accounts.map((a) => a.id))
  for (const [id, unsubscribe] of activeSubscriptions) {
    if (!desiredIds.has(id)) {
      unsubscribe()
      activeSubscriptions.delete(id)
    }
  }
  for (const account of accounts) {
    void subscribeAccountSafe(
      account,
      accessTokens[account.network],
      queryClient
    )
  }
}

export function useArkNotifications() {
  const queryClient = useQueryClient()
  const [accounts, serverAccessTokens] = useArkStore(
    useShallow((state) => [state.accounts, state.serverAccessTokens])
  )

  useEffect(() => {
    syncSubscriptions(accounts, serverAccessTokens, queryClient)
  }, [accounts, serverAccessTokens, queryClient])
}
