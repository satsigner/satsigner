import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  type ArkMovementEvent,
  type ArkNotificationUnsubscribe,
  openArkWallet,
  subscribeArkNotifications,
  syncArkWallet
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

const RECEIVE_TOAST_DEDUP_TTL_MS = 60_000
const recentReceiveToasts = new Map<string, number>()

function shouldSkipDuplicateReceiveToast(key: string): boolean {
  const now = Date.now()
  for (const [existingKey, timestamp] of recentReceiveToasts) {
    if (now - timestamp > RECEIVE_TOAST_DEDUP_TTL_MS) {
      recentReceiveToasts.delete(existingKey)
    }
  }
  const last = recentReceiveToasts.get(key)
  if (last !== undefined && now - last < RECEIVE_TOAST_DEDUP_TTL_MS) {
    return true
  }
  recentReceiveToasts.set(key, now)
  return false
}

function notifyReceive(account: ArkAccount, event: ArkMovementEvent) {
  if (event.type !== 'created' || event.effectiveBalanceSats <= 0) {
    return
  }
  const key = `${account.id}:${event.movementId}`
  if (shouldSkipDuplicateReceiveToast(key)) {
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

function tearDownAllSubscriptions() {
  for (const [id, unsubscribe] of activeSubscriptions) {
    unsubscribe()
    activeSubscriptions.delete(id)
  }
}

async function resyncAccount(
  account: ArkAccount,
  queryClient: QueryClient
): Promise<void> {
  try {
    await syncArkWallet(account.serverId, account.id)
  } catch {
    // best effort — wallet may not be open yet on resume
  }
  queryClient.invalidateQueries({ queryKey: ['ark', 'balance', account.id] })
  queryClient.invalidateQueries({ queryKey: ['ark', 'movements', account.id] })
}

function handleAppForeground(queryClient: QueryClient) {
  const { accounts, serverAccessTokens } = useArkStore.getState()
  tearDownAllSubscriptions()
  syncSubscriptions(accounts, serverAccessTokens, queryClient)
  for (const account of accounts) {
    void resyncAccount(account, queryClient)
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

  useEffect(() => {
    let lastState: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && lastState.match(/background|inactive/)) {
        handleAppForeground(queryClient)
      }
      lastState = next
    })
    return () => subscription.remove()
  }, [queryClient])
}
