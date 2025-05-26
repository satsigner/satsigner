import { type Network } from 'bdk-rn/lib/lib/enums'
import { getPublicKey, nip19 } from 'nostr-tools'
import { useCallback } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { compressMessage, decompressMessage, NostrAPI } from '@/api/nostr'
import { PIN_KEY } from '@/config/auth'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import type { Account, Secret } from '@/types/models/Account'
import {
  formatAccountLabels,
  JSONLtoLabels,
  type Label,
  labelsToJSONL
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
      } catch (_error) {
        // Error closing subscriptions
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
        }
      } catch (_error) {
        // Failed to store DM
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
          } catch (_error) {
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
            } catch (_error) {
              toast.error('Failed to import labels')
            }
          } else if (data_type === 'Tx') {
            // Handle Tx
            toast.info(
              'New Tx Recieve from: ' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12) +
                '...' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(-4) +
                ' - ' +
                eventContent.data.data.slice(0, 12) +
                '...'
            )
          } else if (data_type === 'PSBT') {
            // Handle PSBT
            toast.info(
              'New PSBT Recieve from: ' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12) +
                '...' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(-4) +
                ' - ' +
                eventContent.data.data.slice(0, 12) +
                '...'
            )
          } else if (data_type === 'SignMessageRequest') {
            // POPUP Sign message request
            toast.info(
              'New Sign message request Recieve from: ' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12) +
                '...' +
                nip19.npubEncode(unwrappedEvent.pubkey).slice(-4) +
                ' - ' +
                eventContent.data.data.slice(0, 12) +
                '...'
            )
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
          } catch (_error) {}
        } else if (eventContent.public_key_bech32) {
          const newMember = eventContent.public_key_bech32
          try {
            await addMember(account.id, newMember)
          } catch (_error) {
            // Failed to add member
          }
        }

        return eventContent
      } catch (_error) {
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
    [addMember, storeDM]
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
        await nostrApi.subscribeToKind1059(
          commonNsec as string,
          commonNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Error processing message
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
        await nostrApi.subscribeToKind1059(
          deviceNsec as string,
          deviceNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Error processing message
            }
          },
          undefined,
          lastDataExchangeEOSE,
          (nsec) => updateLasEOSETimestamp(account, nsec)
        )
        return nostrApi
      } catch (_error) {
        toast.error('Failed to setup data exchange subscription:')
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
        return
      }

      if (getActiveSubscriptions().size > 0) {
        return
      }

      // Cleanup existing subscriptions first
      await cleanupSubscriptions()

      try {
        // Start protocol subscription
        const protocolApi = await protocolSubscription(account, onLoadingChange)
        if (protocolApi) {
          addSubscription(protocolApi)
        }

        // Start data exchange subscription
        const dataExchangeApi = await dataExchangeSubscription(
          account,
          onLoadingChange
        )
        if (dataExchangeApi) {
          addSubscription(dataExchangeApi)
        }
      } catch (_error) {
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
    async (account?: Account, singleLabel?: Label) => {
      if (!account?.nostr?.autoSync) {
        return
      }
      if (!account || !account.nostr) {
        return
      }
      const { commonNsec, commonNpub, relays, deviceNpub } = account.nostr

      if (
        !commonNsec ||
        commonNpub === '' ||
        relays.length === 0 ||
        !deviceNpub
      ) {
        return
      }

      let labels: Label[] = []
      if (singleLabel) {
        // For single label, we need to get all current labels and add the new one
        labels = formatAccountLabels(account)
        labels.push(singleLabel)
      } else {
        labels = formatAccountLabels(account)
      }

      // Always check fingerprint for both single and bulk cases
      const message = labelsToJSONL(labels)
      const hash = await sha256(message)
      const fingerprint = hash.slice(0, 8)

      // Only skip if it's not a single label and fingerprint matches
      if (!singleLabel && fingerprint === account.nostr.lastBackupFingerprint) {
        return
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
    []
  )

  const sendDM = useCallback(async (account: Account, message: string) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { commonNsec, commonNpub, deviceNsec, deviceNpub, relays } =
      account.nostr

    if (
      !commonNsec ||
      !commonNpub ||
      relays.length === 0 ||
      !deviceNsec ||
      !deviceNpub
    ) {
      return
    }

    let nostrApi: NostrAPI | null = null
    try {
      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        description: message
      }

      const compressedMessage = compressMessage(messageContent)
      nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      let eventKind1059 = await nostrApi.createKind1059(
        deviceNsec,
        deviceNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)

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
    } catch (_error) {
      toast.error('Failed to send message')
    }
  }, [])

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
    } catch (_error) {
      throw _error
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
      return
    }

    let nostrApi: NostrAPI | null = null
    try {
      const messageContent = {
        created_at: Math.floor(Date.now() / 1000),
        public_key_bech32: deviceNpub
      }

      const compressedMessage = compressMessage(messageContent)
      nostrApi = new NostrAPI(relays)
      await nostrApi.connect()

      const eventKind1059 = await nostrApi.createKind1059(
        commonNsec,
        commonNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)
    } catch (_error) {
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
