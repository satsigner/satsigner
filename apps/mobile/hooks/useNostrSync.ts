import { type Network } from 'bdk-rn/lib/lib/enums'
import { getPublicKey, nip19 } from 'nostr-tools'
import { useCallback, useRef } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { NostrAPI, decompressMessage, compressMessage } from '@/api/nostr'
import { PIN_KEY } from '@/config/auth'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import type { Account, Secret, DM } from '@/types/models/Account'
import {
  formatAccountLabels,
  labelsToJSONL,
  JSONLtoLabels
} from '@/utils/bip329'
import { aesDecrypt, sha256 } from '@/utils/crypto'

function getTrustedDevices(accountId: string): string[] {
  const account = useAccountsStore
    .getState()
    .accounts.find((account) => account.id === accountId)
  return account?.nostr?.trustedMemberDevices || []
}

function useNostrSync() {
  const [updateAccountNostr] = useAccountsStore(
    useShallow((state) => [state.updateAccountNostr])
  )
  const addMember = useNostrStore((state) => state.addMember)
  const addSubscription = useNostrStore((state) => state.addSubscription)
  const clearSubscriptions = useNostrStore((state) => state.clearSubscriptions)
  const getActiveSubscriptions = useNostrStore(
    (state) => state.getActiveSubscriptions
  )

  const cleanupSubscriptions = useCallback(async () => {
    const apisToCleanup = Array.from(getActiveSubscriptions())
    clearSubscriptions()

    for (const api of apisToCleanup) {
      try {
        await api.closeAllSubscriptions()
      } catch (error) {
        console.error('Error closing subscriptions:', error)
      }
    }
  }, [clearSubscriptions, getActiveSubscriptions])

  const storeDM = useCallback(
    async (account?: Account, unwrappedEvent?: any, eventContent?: any) => {
      if (!account || !unwrappedEvent) return

      if (eventContent.created_at > Date.now() / 1000 + 60 * 5) {
        return
      }

      try {
        const newMessage = {
          id: unwrappedEvent.id,
          author: unwrappedEvent.pubkey,
          created_at: eventContent.created_at,
          description: eventContent.description,
          event: JSON.stringify(unwrappedEvent),
          label: 1,
          content: {
            description: eventContent.description,
            created_at: eventContent.created_at,
            pubkey: unwrappedEvent.pubkey
          }
        }

        // Trigger notifcation only if message is recent and is not sent to self
        const lastDataExchangeEOSE =
          useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0
        if (
          eventContent.created_at > lastDataExchangeEOSE &&
          account.nostr.deviceNpub !==
            nip19.npubEncode(unwrappedEvent.pubkey) &&
          eventContent.created_at < Date.now() / 1000 - 60 * 5
        ) {
          const npub = nip19.npubEncode(unwrappedEvent.pubkey)
          const formatedAuthor = npub.slice(0, 12) + '...' + npub.slice(-4)
          toast.info(formatedAuthor + ': ' + eventContent.description)
        }

        console.log('🟢 eventContent.description', eventContent.description)

        // Get the current state directly from the store to ensure we have the latest
        const currentState = useAccountsStore.getState()
        const currentAccount = currentState.accounts.find(
          (a) => a.id === account.id
        )
        if (!currentAccount?.nostr) return

        const currentDms = currentAccount.nostr.dms || []

        // Check if message with same ID already exists
        const messageExists = currentDms.some((m) => m.id === newMessage.id)

        // If message doesn't exist, add it and sort by timestamp
        if (!messageExists) {
          const updatedDms = [...currentDms, newMessage].sort(
            (a, b) => a.created_at - b.created_at
          )

          // Update only the dms field, preserving all other nostr fields
          updateAccountNostr(account.id, {
            dms: updatedDms
          })

          // Log the state after update
          const afterState = useAccountsStore.getState()
          const afterAccount = afterState.accounts.find(
            (a) => a.id === account.id
          )
        } else {
          console.log('🔵 Message already exists, skipping:', newMessage.id)
        }
      } catch (error) {
        console.error('Failed to store DM:', error)
      }
    },
    [updateAccountNostr]
  )

  const processEvent = useCallback(
    async (account: Account, unwrappedEvent: any): Promise<string> => {
      // Check for processed events at the very beginning
      const processedEvents =
        useNostrStore.getState().processedEvents[account.id] || []
      if (processedEvents.includes(unwrappedEvent.id)) {
        console.log('Skipping already processed event:', unwrappedEvent.id)
        return ''
      }

      // Mark event as processed immediately to prevent duplicate processing
      useNostrStore.getState().addProcessedEvent(account.id, unwrappedEvent.id)

      try {
        let eventContent: any
        try {
          eventContent = JSON.parse(unwrappedEvent.content)
        } catch (_jsonError) {
          try {
            eventContent = decompressMessage(unwrappedEvent.content)
          } catch (decompressError) {
            eventContent = unwrappedEvent.content
          }
        }

        if (eventContent.data) {
          const data_type = eventContent.data.data_type
          if (data_type === 'LabelsBip329') {
            try {
              if (eventContent.data.data.length === 1) {
                const label = eventContent.data.data[0].label
                const ref = eventContent.data.data[0].ref
                useAccountsStore.getState().setTxLabel(account.id, ref, label)
              } else {
                const labels = JSONLtoLabels(eventContent.data.data)
                const store = useAccountsStore.getState()
                const labelsAdded = store.importLabels(account.id, labels)
                if (labelsAdded > 0) {
                  toast.success(`Imported ${labelsAdded} labels`)
                }
              }
            } catch (error) {
              toast.error('Failed to import labels')
            }
          }
        } else if (eventContent.description && !eventContent.data) {
          try {
            //ignore if is sent to commonNpub
            if (
              account.nostr.commonNpub !==
              nip19.npubEncode(unwrappedEvent.tags[0][1])
            ) {
              await storeDM(account, unwrappedEvent, eventContent)
            }
          } catch (error) {}
        } else if (eventContent.public_key_bech32) {
          const newMember = eventContent.public_key_bech32
          try {
            await addMember(account.id, newMember)
          } catch (error) {
            console.error('Failed to add member:', error)
          }
        }

        return eventContent
      } catch (error) {
        // If processing fails, remove the event from processed events
        const currentProcessedEvents =
          useNostrStore.getState().processedEvents[account.id] || []
        useNostrStore.getState().clearProcessedEvents(account.id)
        const remainingEvents = currentProcessedEvents.filter(
          (id) => id !== unwrappedEvent.id
        )
        remainingEvents.forEach((eventId) => {
          useNostrStore.getState().addProcessedEvent(account.id, eventId)
        })
        return ''
      }
    },
    [addMember]
  )

  const protocolSubscription = useCallback(
    async (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      const { autoSync, commonNsec, commonNpub, relays } = account.nostr
      const lastProtocolEOSE =
        useNostrStore.getState().getLastProtocolEOSE(account.id) || 0

      if (!autoSync || !commonNsec || !commonNpub || relays.length === 0) {
        return null
      }

      let nostrApi: NostrAPI | null = null
      try {
        nostrApi = new NostrAPI(relays)
        if (onLoadingChange) {
          nostrApi.setLoadingCallback(onLoadingChange)
        }
        await nostrApi.connect()
        console.log('🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵🔵 protocolSubscription')
        await nostrApi.subscribeToKind1059(
          commonNsec as string,
          commonNpub as string,
          async (message) => {
            try {
              console.log('🔵 event id    ', message.id)
              console.log('🔵 event pubkey', message.pubkey)
              console.log(
                '🔵 event date  ',
                new Date(message.created_at * 1000).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              )
              await processEvent(account, message.content)
            } catch (_error) {
              // Handle error silently
            }
          },
          undefined,
          lastProtocolEOSE,
          (nsec) => updateLasEOSETimestamp(account, nsec)
        )
        return nostrApi
      } catch (_error) {
        toast.error('Failed to subscribe to protocol events')
        if (nostrApi) {
          await nostrApi.closeAllSubscriptions()
        }
        return null
      }
    },
    [processEvent]
  )

  const dataExchangeSubscription = useCallback(
    async (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      const { autoSync, deviceNsec, deviceNpub, relays } = account.nostr
      const lastDataExchangeEOSE =
        useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

      if (!autoSync || !deviceNsec || !deviceNpub || relays.length === 0) {
        return null
      }

      let nostrApi: NostrAPI | null = null
      try {
        nostrApi = new NostrAPI(relays)
        if (onLoadingChange) {
          nostrApi.setLoadingCallback(onLoadingChange)
        }
        await nostrApi.connect()
        console.log('🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴 dataExchangeSubscription')
        await nostrApi.subscribeToKind1059(
          deviceNsec as string,
          deviceNpub as string,
          async (message) => {
            try {
              console.log('🔴 event id    ', message.id)
              console.log('🔴 event pubkey', message.pubkey)
              console.log(
                '🔴 event date  ',
                new Date(message.created_at * 1000).toLocaleString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })
              )
              await processEvent(account, message.content)
            } catch (error) {
              console.error('Error processing message:', error)
            }
          },
          undefined,
          lastDataExchangeEOSE,
          (nsec) => updateLasEOSETimestamp(account, nsec)
        )
        return nostrApi
      } catch (error) {
        console.error('Failed to setup data exchange subscription:', error)
        toast.error('Failed to subscribe to data exchange')
        if (nostrApi) {
          await nostrApi.closeAllSubscriptions()
        }
        return null
      }
    },
    [processEvent]
  )

  const nostrSyncSubscriptions = useCallback(
    async (account?: Account, onLoadingChange?: (loading: boolean) => void) => {
      if (!account || !account.nostr) {
        console.log('No account or nostr data available')
        return
      }

      if (getActiveSubscriptions().size > 0) {
        console.log('ACTIVE SUBSCRIPTIONS - STOP HERE')
        return
      }

      console.log('Starting nostr sync subscriptions:', {
        accountId: account.id,
        autoSync: account.nostr.autoSync,
        activeSubscriptions: getActiveSubscriptions().size
      })

      // Cleanup existing subscriptions first
      await cleanupSubscriptions()

      try {
        // Start protocol subscription
        const protocolApi = await protocolSubscription(account, onLoadingChange)
        if (protocolApi) {
          addSubscription(protocolApi)
          console.log('Protocol subscription started')
        }

        // Start data exchange subscription
        const dataExchangeApi = await dataExchangeSubscription(
          account,
          onLoadingChange
        )
        if (dataExchangeApi) {
          addSubscription(dataExchangeApi)
          console.log('Data exchange subscription started')
        }

        console.log('All subscriptions started:', {
          count: getActiveSubscriptions().size,
          subscriptions: Array.from(getActiveSubscriptions()).map((api) => ({
            isActive: true,
            relays: api.getRelays()
          }))
        })
      } catch (error) {
        console.error('Error starting subscriptions:', error)
        toast.error('Failed to start subscriptions')
        await cleanupSubscriptions()
      }
    },
    [
      protocolSubscription,
      dataExchangeSubscription,
      cleanupSubscriptions,
      addSubscription,
      getActiveSubscriptions
    ]
  )

  const sendLabelsToNostr = useCallback(
    async (account?: Account, singleLabel?: any) => {
      if (!account?.nostr?.autoSync) return
      if (!account || !account.nostr) return
      const { commonNsec, commonNpub, relays, deviceNpub } = account.nostr

      if (
        !commonNsec ||
        commonNpub === '' ||
        relays.length === 0 ||
        !deviceNpub
      ) {
        return
      }

      let labels: any[] = []
      if (singleLabel) {
        labels.push(singleLabel)
      } else {
        labels = formatAccountLabels(account)
        const message = labelsToJSONL(labels)
        const hash = await sha256(message)
        const fingerprint = hash.slice(0, 8)
        if (fingerprint === account.nostr.lastBackupFingerprint) {
          return
        }
      }

      try {
        if (labels.length === 0) {
          toast.error(t('account.nostrSync.errorMissingData'))
          return
        }

        const labelPackage = labels.map((label) => ({
          __class__: 'Label',
          VERSION: '0.0.3',
          type: label.type,
          ref: label.ref,
          label: label.label,
          spendable: label.spendable,
          timestamp: Math.floor(Date.now() / 1000)
        }))

        const labelPackageJSONL = labelsToJSONL(labelPackage)
        const messageContent = {
          created_at: Math.floor(Date.now() / 1000),
          label: 1,
          description: 'Here come some labels',
          data: { data: labelPackageJSONL, data_type: 'LabelsBip329' }
        }

        const compressedMessage = compressMessage(messageContent)
        const nostrApi = new NostrAPI(relays)
        await nostrApi.connect()

        const deviceNsec = account.nostr.deviceNsec
        const trustedDevices = getTrustedDevices(account.id)

        for (const trustedDeviceNpub of trustedDevices) {
          if (!deviceNsec) continue
          const eventKind1059 = await nostrApi.createKind1059(
            deviceNsec,
            trustedDeviceNpub,
            compressedMessage
          )
          await nostrApi.publishEvent(eventKind1059)
        }
      } catch (_error) {
        toast.error('Failed to send message')
      }
    },
    [updateAccountNostr]
  )

  const sendDM = useCallback(
    async (account?: Account, message?: any) => {
      if (!account?.nostr?.autoSync) return
      if (!account || !account.nostr) return
      const { commonNsec, commonNpub, relays, deviceNpub } = account.nostr

      if (
        !commonNsec ||
        commonNpub === '' ||
        relays.length === 0 ||
        !deviceNpub
      ) {
        return
      }

      let nostrApi: NostrAPI | null = null
      try {
        const messageContent = {
          // TODO Messages sometimes get out of order, check if created_at timesstamping matches other clients (bitcoin-safe)
          created_at: Math.floor(Date.now() / 1000),
          label: 1,
          description: message
        }

        const compressedMessage = compressMessage(messageContent)
        nostrApi = new NostrAPI(relays)
        await nostrApi.connect()

        const deviceNsec = account.nostr.deviceNsec
        if (!deviceNsec) {
          throw new Error('Device NSEC not found')
        }

        // Send to our deviceNpub
        let eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          deviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)

        /*
        
        // Send to commonNpub to match protocol
        eventKind1059 = await nostrApi.createKind1059(
          deviceNsec,
          commonNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)
        
        */

        /*
        const newMessage = {
          id: eventKind1059.id,
          author: deviceNpub,
          created_at: messageContent.created_at,
          description: message,
          event: JSON.stringify(eventKind1059),
          label: 1,
          content: {
            description: message,
            created_at: messageContent.created_at,
            pubkey: deviceNpub
          }
        }

        /*
        const currentDms = account.nostr?.dms || []
        const updatedDms = [...currentDms, newMessage].sort(
          (a, b) => a.created_at - b.created_at
        )

        updateAccountNostr(account.id, {
          ...account.nostr,
          dms: updatedDms
        })
        */
        const trustedDevices = getTrustedDevices(account.id)
        for (const trustedDeviceNpub of trustedDevices) {
          if (!deviceNsec) continue
          eventKind1059 = await nostrApi.createKind1059(
            deviceNsec,
            trustedDeviceNpub,
            compressedMessage
          )
          await nostrApi.publishEvent(eventKind1059)
        }
      } catch (error) {
        console.error('Failed to send message:', error)
        toast.error('Failed to send message')
      }
    },
    [updateAccountNostr]
  )

  const loadStoredDMs = useCallback(async (account?: Account) => {
    if (!account) return []
    return account.nostr?.dms || []
  }, [])

  const clearStoredDMs = useCallback(
    async (account?: Account) => {
      if (!account?.nostr) return
      updateAccountNostr(account.id, {
        ...account.nostr,
        dms: []
      })
    },
    [updateAccountNostr]
  )

  const generateCommonNostrKeys = useCallback(async (account?: Account) => {
    if (!account) return
    const pin = await getItem(PIN_KEY)
    if (!pin) return

    try {
      const isImportAddress = account.keys[0].creationType === 'importAddress'
      const temporaryAccount = JSON.parse(JSON.stringify(account)) as Account

      for (const key of temporaryAccount.keys) {
        const decryptedSecretString = await aesDecrypt(
          key.secret as string,
          pin,
          key.iv
        )
        const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
        key.secret = decryptedSecret
      }

      if (isImportAddress) {
        const secret = temporaryAccount.keys[0].secret as Secret
        return {
          externalDescriptor: secret.externalDescriptor,
          internalDescriptor: undefined
        }
      }

      const walletData = await getWalletData(
        temporaryAccount,
        temporaryAccount.network as Network
      )
      if (!walletData) {
        throw new Error('Failed to get wallet data')
      }

      const descriptor = walletData.externalDescriptor
      const match = descriptor.match(/\[([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\]/)
      if (!match) {
        throw new Error('Invalid descriptor format')
      }

      const [, , purpose, coinType, accountIndex] = match
      const hardenedPath = `m/${purpose.replace("'", 'h')}/${coinType.replace("'", 'h')}/${accountIndex.replace("'", 'h')}`

      const xpubRegex = /(tpub|vpub|upub|zpub)[a-zA-Z0-9]+/g
      const xpubs = (descriptor.match(xpubRegex) || []).sort()

      const totalString = hardenedPath + xpubs.join('')

      const firstHash = await sha256(totalString)
      const doubleHash = await sha256(firstHash)

      const privateKeyBytes = new Uint8Array(Buffer.from(doubleHash, 'hex'))
      const publicKey = getPublicKey(privateKeyBytes)
      const commonNsec = nip19.nsecEncode(privateKeyBytes)
      const commonNpub = nip19.npubEncode(publicKey)

      return {
        commonNsec,
        commonNpub,
        privateKeyBytes
      }
    } catch (error) {
      throw error
    }
  }, [])

  function updateLasEOSETimestamp(account: Account, nsec: string) {
    const timestamp = Math.floor(Date.now() / 1000) - 3600 // Subtract 1 hour
    if (nsec === account.nostr.commonNsec) {
      useNostrStore.getState().setLastProtocolEOSE(account.id, timestamp)
    } else if (nsec === account.nostr.deviceNsec) {
      useNostrStore.getState().setLastDataExchangeEOSE(account.id, timestamp)
    }
  }

  const deviceAnnouncement = useCallback(async (account?: Account) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { commonNsec, commonNpub, deviceNpub, relays } = account.nostr

    if (!commonNsec || !commonNpub || relays.length === 0 || !deviceNpub) {
      console.log('❤️❤️✅❤️✅❤️❤️ ----- Device announcement not sent')
      return
    }

    let nostrApi: NostrAPI | null = null
    console.log('❤️❤️❤️❤️❤️ -----Device announcement sent')
    try {
      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        public_key_bech32: deviceNpub
      }

      console.log('❤️❤️❤️❤️❤️ ------------- Device announcement sent')

      const compressedMessage = compressMessage(messageContent)
      nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      const eventKind1059 = await nostrApi.createKind1059(
        commonNsec,
        commonNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)
    } catch (error) {
      console.error('Failed to send device announcement:', error)
      toast.error('Failed to send device announcement')
    }
  }, [])

  return {
    sendLabelsToNostr,
    dataExchangeSubscription,
    generateCommonNostrKeys,
    storeDM,
    sendDM,
    loadStoredDMs,
    clearStoredDMs,
    processEvent,
    protocolSubscription,
    cleanupSubscriptions,
    deviceAnnouncement,
    nostrSyncSubscriptions,
    addProcessedMessageId: useNostrStore.getState().addProcessedEvent,
    getActiveSubscriptions
  }
}

export default useNostrSync
