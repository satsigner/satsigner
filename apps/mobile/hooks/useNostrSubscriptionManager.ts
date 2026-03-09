import { useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import {
  PROTOCOL_SUBSCRIPTION_LIMIT,
  PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN
} from '@/constants/nostr'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'

import { useNostrMessageProcessor } from './useNostrMessageProcessor'

function useNostrSubscriptionManager() {
  const [
    addSubscription,
    clearSubscriptions,
    getActiveSubscriptions,
    getLastDataExchangeEOSE,
    getLastProtocolEOSE,
    setLastProtocolEOSE,
    setLastDataExchangeEOSE
  ] = useNostrStore(
    useShallow((state) => [
      state.addSubscription,
      state.clearSubscriptions,
      state.getActiveSubscriptions,
      state.getLastDataExchangeEOSE,
      state.getLastProtocolEOSE,
      state.setLastProtocolEOSE,
      state.setLastDataExchangeEOSE
    ])
  )

  const messageProcessor = useNostrMessageProcessor()

  const updateLastEOSETimestamp = useCallback(
    (account: Account, nsec: string): void => {
      // NIP-17 compliance: The 2-day time uncertainty is already handled in api/nostr.ts
      // when constructing the subscription filter. We store the current timestamp here.
      const timestamp = Math.floor(Date.now() / 1000)
      if (nsec === account.nostr.commonNsec) {
        setLastProtocolEOSE(account.id, timestamp)
      } else if (nsec === account.nostr.deviceNsec) {
        setLastDataExchangeEOSE(account.id, timestamp)
      }
    },
    [setLastProtocolEOSE, setLastDataExchangeEOSE]
  )

  const createProtocolSubscription = useCallback(
    async (
      account: Account,
      onLoadingChange?: (loading: boolean) => void
    ): Promise<NostrAPI | null> => {
      const { autoSync, commonNsec, commonNpub, relays } = account.nostr
      const lastProtocolEOSE = getLastProtocolEOSE(account.id) || 0

      if (!autoSync || !commonNsec || !commonNpub || relays.length === 0) {
        return null
      }

      const nostrApi = new NostrAPI(relays)
      if (onLoadingChange) {
        nostrApi.setLoadingCallback(onLoadingChange)
      }
      await nostrApi.connect()
      const isFullRescan = lastProtocolEOSE === 0
      const limit = isFullRescan
        ? PROTOCOL_SUBSCRIPTION_LIMIT_FULL_SCAN
        : PROTOCOL_SUBSCRIPTION_LIMIT
      await nostrApi.subscribeToKind1059(
        commonNsec as string,
        commonNpub as string,
        (messages) => messageProcessor.processEventBatch(account, messages),
        limit,
        lastProtocolEOSE,
        (nsec) => updateLastEOSETimestamp(account, nsec)
      )
      return nostrApi
    },
    [getLastProtocolEOSE, messageProcessor, updateLastEOSETimestamp]
  )

  const createDataExchangeSubscription = useCallback(
    async (
      account: Account,
      onLoadingChange?: (loading: boolean) => void
    ): Promise<NostrAPI | null> => {
      const { autoSync, deviceNsec, deviceNpub, relays } = account.nostr
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0

      if (!autoSync || !deviceNsec || !deviceNpub || relays.length === 0) {
        return null
      }

      const nostrApi = new NostrAPI(relays)
      if (onLoadingChange) {
        nostrApi.setLoadingCallback(onLoadingChange)
      }
      await nostrApi.connect()
      await nostrApi.subscribeToKind1059(
        deviceNsec as string,
        deviceNpub as string,
        (messages) => messageProcessor.processEventBatch(account, messages),
        undefined,
        lastDataExchangeEOSE,
        (nsec) => updateLastEOSETimestamp(account, nsec)
      )
      return nostrApi
    },
    [getLastDataExchangeEOSE, messageProcessor, updateLastEOSETimestamp]
  )

  const cleanup = useCallback(async () => {
    const apisToCleanup = Array.from(getActiveSubscriptions())
    clearSubscriptions()

    const cleanupPromises = apisToCleanup.map(async (api) => {
      try {
        await api.closeAllSubscriptions()
      } catch {
        toast.error(
          `Failed to clean subscription for: ${api.getRelays().join(', ')}`
        )
      }
    })

    await Promise.allSettled(cleanupPromises)
  }, [clearSubscriptions, getActiveSubscriptions])

  const isSubscribingRef = useRef(false)
  const subscribe = useCallback(
    async (account?: Account, onLoadingChange?: (loading: boolean) => void) => {
      if (!account || !account.nostr) return
      if (isSubscribingRef.current) return
      isSubscribingRef.current = true
      try {
        const existingApis = Array.from(getActiveSubscriptions())
        const currentRelays = account?.nostr?.relays || []

        // Check if we already have valid subscriptions for this account
        const hasValidSubscription = existingApis.some((api) => {
          const relays = api.getRelays()
          return (
            relays.length > 0 &&
            relays.every((r) => currentRelays.includes(r)) &&
            currentRelays.every((r) => relays.includes(r))
          )
        })

        if (hasValidSubscription) return

        // Process any pending events before cleanup
        for (const api of existingApis) {
          await api.flushQueue?.()
        }

        await cleanup()

        const [protocolApi, dataExchangeApi] = await Promise.all([
          createProtocolSubscription(account, onLoadingChange),
          createDataExchangeSubscription(account, onLoadingChange)
        ])

        if (protocolApi) addSubscription(protocolApi)
        if (dataExchangeApi) addSubscription(dataExchangeApi)
      } finally {
        isSubscribingRef.current = false
      }
    },
    [
      cleanup,
      createProtocolSubscription,
      createDataExchangeSubscription,
      addSubscription,
      getActiveSubscriptions
    ]
  )

  return useMemo(
    () => ({
      subscribe,
      cleanup,
      createProtocolSubscription,
      createDataExchangeSubscription,
      getActiveSubscriptions
    }),
    [
      subscribe,
      cleanup,
      createProtocolSubscription,
      createDataExchangeSubscription,
      getActiveSubscriptions
    ]
  )
}

export { useNostrSubscriptionManager }
export default useNostrSubscriptionManager
