import { useCallback, useRef } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  NostrAPI,
  PROTOCOL_SUBSCRIPTION_LIMIT
} from '@/api/nostr'

function nostrSyncLog(...args: unknown[]) {
  if (__DEV__) console.log('[NostrSync]', ...args)
}
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
      const timestamp = Math.floor(Date.now() / 1000) - 3600 // Subtract 1 hour
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
      await nostrApi.subscribeToKind1059(
        commonNsec as string,
        commonNpub as string,
        (messages) => messageProcessor.processEventBatch(account, messages),
        PROTOCOL_SUBSCRIPTION_LIMIT,
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
    nostrSyncLog('cleanup start', apisToCleanup.length, 'subscriptions')
    clearSubscriptions()

    const cleanupPromises = apisToCleanup.map(async (api) => {
      try {
        await api.closeAllSubscriptions()
      } catch {
        toast.error(
          'Failed to clean subscription for: ' + api.getRelays().join(', ')
        )
      }
    })

    await Promise.allSettled(cleanupPromises)
    nostrSyncLog('cleanup done')
  }, [clearSubscriptions, getActiveSubscriptions])

  const isSubscribingRef = useRef(false)
  const subscribe = useCallback(
    async (account?: Account, onLoadingChange?: (loading: boolean) => void) => {
      if (!account || !account.nostr) {
        nostrSyncLog('subscribe skip: no account or nostr')
        return
      }
      if (isSubscribingRef.current) {
        nostrSyncLog('subscribe skip: already in progress')
        return
      }
      isSubscribingRef.current = true
      nostrSyncLog('subscribe start', account.id)
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

        if (hasValidSubscription) {
          nostrSyncLog('subscribe skip: valid subscription exists')
          return
        }

        // Process any pending events before cleanup
        for (const api of existingApis) {
          await api.flushQueue?.()
        }

        await cleanup()

        nostrSyncLog('subscribe creating protocol + dataExchange')
        const [protocolApi, dataExchangeApi] = await Promise.all([
          createProtocolSubscription(account, onLoadingChange),
          createDataExchangeSubscription(account, onLoadingChange)
        ])

        if (protocolApi) {
          addSubscription(protocolApi)
          nostrSyncLog('subscribe protocol added')
        }
        if (dataExchangeApi) {
          addSubscription(dataExchangeApi)
          nostrSyncLog('subscribe dataExchange added')
        }
        nostrSyncLog('subscribe done')
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

  return {
    subscribe,
    cleanup,
    createProtocolSubscription,
    createDataExchangeSubscription,
    getActiveSubscriptions
  }
}

export { useNostrSubscriptionManager }
export default useNostrSubscriptionManager
