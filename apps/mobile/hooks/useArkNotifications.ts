import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

import {
  openArkWallet,
  subscribeArkNotifications,
  syncArkWallet
} from '@/api/ark'
import { ARK_SWAP_RUNNER_QUERY_KEY } from '@/constants/ark'
import {
  forgetArkNotificationSubscription,
  hasArkNotificationSubscription,
  listArkNotificationSubscriptionIds,
  setArkNotificationSubscription
} from '@/services/arkNotificationSubscriptions'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useArkReceiveOverlayStore } from '@/store/arkReceiveOverlay'
import { useArkSwapsStore } from '@/store/arkSwaps'
import type { ArkAccount, ArkMovementEvent } from '@/types/models/Ark'
import { getArkServer } from '@/utils/ark'
import { shouldAnnounceArkReceive } from '@/utils/arkMovement'
import { isArkSwapForwardedPayment } from '@/utils/arkSwap'
import { invalidateArkAccountQueries } from '@/utils/arkSync'
import { devLog, devStep } from '@/utils/devConsole'

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
    devLog('ark', `refetch ${accountId}`)
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
  if (!shouldAnnounceArkReceive(event)) {
    return
  }
  const key = `${account.id}:${event.movementId}`
  if (shouldSkipDuplicateReceiveEvent(key)) {
    return
  }
  devLog('ark', `receive overlay ${event.effectiveBalanceSats} sats`)
  useArkReceiveOverlayStore.getState().enqueueReceive({
    accountId: account.id,
    accountName: account.name,
    amountSats: event.effectiveBalanceSats,
    movementId: event.movementId
  })
}

// A swap's lightning payment is forwarded on-chain, so it advances the swap
// instead of announcing a receive the user does not keep in Ark.
function handleMovementEvent(
  account: ArkAccount,
  event: ArkMovementEvent,
  queryClient: QueryClient
) {
  if (isArkSwapForwardedPayment(useArkSwapsStore.getState().jobs, event)) {
    void queryClient.invalidateQueries(
      { queryKey: ARK_SWAP_RUNNER_QUERY_KEY },
      { cancelRefetch: false }
    )
    return
  }
  notifyReceive(account, event)
}

async function subscribeAccount(
  account: ArkAccount,
  queryClient: QueryClient
): Promise<void> {
  if (
    hasArkNotificationSubscription(account.id) ||
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
    await devStep('ark', `open wallet ${account.name}`)
    await openArkWallet({
      accountId: account.id,
      datadir,
      mnemonic,
      server
    })
    devLog('ark', `wallet open ${account.name}`)

    const accountStillExists = useArkStore
      .getState()
      .accounts.some((a) => a.id === account.id)
    if (!accountStillExists || hasArkNotificationSubscription(account.id)) {
      return
    }

    const unsubscribe = subscribeArkNotifications(
      account.serverId,
      account.id,
      (event) => {
        devLog('ark', `event ${event.type} ${account.name}`)
        scheduleAccountInvalidation(queryClient, account.id)
        handleMovementEvent(account, event, queryClient)
      }
    )
    setArkNotificationSubscription(account.id, unsubscribe)
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
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    devLog('ark', `open ${account.name} failed: ${reason}`, 'error')
    inflightSubscriptions.delete(account.id)
  }
}

function syncSubscriptions(accounts: ArkAccount[], queryClient: QueryClient) {
  const desiredIds = new Set(accounts.map((a) => a.id))
  for (const id of listArkNotificationSubscriptionIds()) {
    if (!desiredIds.has(id)) {
      forgetArkNotificationSubscription(id)
    }
  }
  for (const account of accounts) {
    void subscribeAccountSafe(account, queryClient)
  }
}

function tearDownAllSubscriptions() {
  for (const id of listArkNotificationSubscriptionIds()) {
    forgetArkNotificationSubscription(id)
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
  devLog('ark', 'app foreground: resubscribe and resync')
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
    // Defer native wallet open until after the first unlocked frame.
    const id = setTimeout(() => {
      syncSubscriptions(accounts, queryClient)
    }, 0)
    return () => clearTimeout(id)
  }, [accounts, queryClient])

  useEffect(() => {
    let lastState = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active' && lastState?.match(/background|inactive/)) {
        handleAppForeground(queryClient)
      }
      lastState = next
    })
    return () => subscription.remove()
  }, [queryClient])
}
