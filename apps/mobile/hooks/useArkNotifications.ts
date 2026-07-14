import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import {
  openArkWallet,
  subscribeArkNotifications,
  syncArkWallet
} from '@/api/ark'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useArkReceiveOverlayStore } from '@/store/arkReceiveOverlay'
import type {
  ArkAccount,
  ArkMovementEvent,
  ArkNotificationUnsubscribe
} from '@/types/models/Ark'
import { getArkServer } from '@/utils/ark'
import { invalidateArkAccountQueries } from '@/utils/arkSync'

const activeSubscriptions = new Map<string, ArkNotificationUnsubscribe>()
const inflightSubscriptions = new Set<string>()
const RECEIVE_EVENT_DEDUP_TTL_MS = 60_000
const recentReceiveEvents = new Map<string, number>()
const INVALIDATE_DEBOUNCE_MS = 400
const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>()

// Rounds/refreshes emit bursts of movement events; coalesce them so each
// burst costs one refetch batch instead of one per event.
function scheduleAccountInvalidation(
  queryClient: QueryClient,
  accountId: string
) {
  const existing = pendingInvalidations.get(accountId)
  if (existing) {
    clearTimeout(existing)
  }
  const timer = setTimeout(() => {
    pendingInvalidations.delete(accountId)
    void invalidateArkAccountQueries(queryClient, accountId)
  }, INVALIDATE_DEBOUNCE_MS)
  pendingInvalidations.set(accountId, timer)
}

function shouldSkipDuplicateReceiveEvent(key: string): boolean {
  const now = Date.now()
  for (const [existingKey, timestamp] of recentReceiveEvents) {
    if (now - timestamp > RECEIVE_EVENT_DEDUP_TTL_MS) {
      recentReceiveEvents.delete(existingKey)
    }
  }
  const last = recentReceiveEvents.get(key)
  if (last !== undefined && now - last < RECEIVE_EVENT_DEDUP_TTL_MS) {
    return true
  }
  recentReceiveEvents.set(key, now)
  return false
}

function notifyReceive(account: ArkAccount, event: ArkMovementEvent) {
  if (event.type !== 'created' || event.effectiveBalanceSats <= 0) {
    return
  }
  const key = `${account.id}:${event.movementId}`
  if (shouldSkipDuplicateReceiveEvent(key)) {
    return
  }
  useArkReceiveOverlayStore.getState().enqueueReceive({
    accountId: account.id,
    accountName: account.name,
    amountSats: event.effectiveBalanceSats,
    movementId: event.movementId
  })
}

async function subscribeAccount(
  account: ArkAccount,
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
      server
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
        scheduleAccountInvalidation(queryClient, account.id)
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
  queryClient: QueryClient
): Promise<void> {
  try {
    await subscribeAccount(account, queryClient)
  } catch {
    inflightSubscriptions.delete(account.id)
  }
}

function syncSubscriptions(accounts: ArkAccount[], queryClient: QueryClient) {
  const desiredIds = new Set(accounts.map((a) => a.id))
  for (const [id, unsubscribe] of activeSubscriptions) {
    if (!desiredIds.has(id)) {
      unsubscribe()
      activeSubscriptions.delete(id)
    }
  }
  for (const account of accounts) {
    void subscribeAccountSafe(account, queryClient)
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
  await invalidateArkAccountQueries(queryClient, account.id)
}

function handleAppForeground(queryClient: QueryClient) {
  const { accounts } = useArkStore.getState()
  tearDownAllSubscriptions()
  syncSubscriptions(accounts, queryClient)
  for (const account of accounts) {
    void resyncAccount(account, queryClient)
  }
}

export function useArkNotifications() {
  const queryClient = useQueryClient()
  const accounts = useArkStore((state) => state.accounts)

  useEffect(() => {
    syncSubscriptions(accounts, queryClient)
  }, [accounts, queryClient])

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
