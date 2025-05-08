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
  const activeSubscriptions = useRef<Set<NostrAPI>>(new Set())

  const cleanupSubscriptions = useCallback(async () => {
    console.log('Cleaning up subscriptions...')
    const apisToCleanup = Array.from(activeSubscriptions.current)
    activeSubscriptions.current.clear() // Clear immediately to prevent race conditions

    for (const api of apisToCleanup) {
      try {
        console.log('Closing subscriptions for API instance')
        await api.closeAllSubscriptions()
        console.log('Successfully closed subscriptions for API instance')
      } catch (error) {
        console.error('Error closing subscriptions:', error)
      }
    }
    console.log('All subscriptions cleaned up')
  }, [])

  const storeDM = useCallback(
    async (account?: Account, unwrappedEvent?: any) => {
      if (!account?.nostr) return

      let content
      try {
        content = JSON.parse(unwrappedEvent.content)
      } catch {
        content = unwrappedEvent.content
      }

      const message = decompressMessage(content)

      const newDM: DM = {
        id: unwrappedEvent.id,
        author: unwrappedEvent.pubkey,
        created_at: message.created_at,
        description: message.description,
        event: JSON.stringify(unwrappedEvent),
        label: 1
      }

      console.log('💬 DM event -- ', message.description)

      const currentDms = account.nostr.dms || []
      const messageExists = currentDms.some(
        (dm) =>
          dm.id === newDM.id ||
          (dm.created_at === newDM.created_at && dm.author === newDM.author)
      )

      if (!messageExists) {
        const updatedDms = [...currentDms, newDM]
        updateAccountNostr(account.id, { dms: updatedDms })
      }
    },
    [updateAccountNostr]
  )

  const processEvent = useCallback(
    async (account: Account, unwrappedEvent: any): Promise<string> => {
      const processedEvents =
        useNostrStore.getState().processedEvents[account.id] || []

      // Skip if already processed
      if (processedEvents.includes(unwrappedEvent.id)) {
        console.log('SKIP')
        return ''
      }

      // Add to processed events immediately to prevent duplicate processing
      useNostrStore.getState().addProcessedEvent(account.id, unwrappedEvent.id)

      try {
        let eventContent: any
        try {
          const jsonContent = JSON.parse(unwrappedEvent.content)
          eventContent = jsonContent
        } catch (_jsonError) {
          try {
            eventContent = decompressMessage(unwrappedEvent.content)
          } catch (_decompressError) {
            eventContent = unwrappedEvent.content
          }
        }

        // Process data events
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
          } else if (data_type === 'PSBT') {
            // Handle PSBT
            // POPUP Sign prompt
          }
        }
        // Process DM events
        else if (eventContent.description && !eventContent.data) {
          await storeDM(account, unwrappedEvent)
        }
        // Process member events
        else if (eventContent.public_key_bech32) {
          const newMember = eventContent.public_key_bech32
          await addMember(account.id, newMember)
        }

        return eventContent
      } catch (error) {
        console.error('Error processing event:', error)
        return ''
      }
    },
    [storeDM, addMember, updateAccountNostr]
  )

  const protocolSubscription = useCallback(
    async (account?: Account, onLoadingChange?: (loading: boolean) => void) => {
      if (!account || !account.nostr) return
      const { autoSync, commonNsec, commonNpub, relays } = account.nostr
      const lastProtocolEOSE =
        useNostrStore.getState().getLastProtocolEOSE(account.id) || 0

      if (!autoSync || !commonNsec || !commonNpub || relays.length === 0) {
        // Clean up any existing subscriptions if conditions aren't met
        await cleanupSubscriptions()
        return
      }

      let nostrApi: NostrAPI | null = null
      try {
        // Clean up any existing subscriptions before creating new ones
        await cleanupSubscriptions()

        nostrApi = new NostrAPI(relays)
        if (onLoadingChange) {
          nostrApi.setLoadingCallback(onLoadingChange)
        }
        await nostrApi.connect()
        activeSubscriptions.current.add(nostrApi)

        await nostrApi.subscribeToKind1059(
          commonNsec as string,
          commonNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Handle error silently
            }
          },
          undefined,
          lastProtocolEOSE,
          (nsec) => updateLasEOSETimestamp(account, nsec)
        )

        console.log('🥸 Protocol Subscription')
        if (lastProtocolEOSE > 0) {
          console.log(
            '🥸 Protocol since ',
            new Date(lastProtocolEOSE * 1000).toLocaleString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          )
        } else {
          console.log('🥸 Protocol since beginning')
        }
      } catch (_error) {
        toast.error('Failed to subscribe to protocol events')
        if (nostrApi) {
          await nostrApi.closeAllSubscriptions()
          activeSubscriptions.current.delete(nostrApi)
        }
      }
    },
    [processEvent, cleanupSubscriptions]
  )

  const dataExchangeSubscription = useCallback(
    async (account?: Account, onLoadingChange?: (loading: boolean) => void) => {
      if (!account || !account.nostr) return
      const { autoSync, deviceNsec, deviceNpub, relays } = account.nostr
      const lastDataExchangeEOSE =
        useNostrStore.getState().getLastDataExchangeEOSE(account.id) || 0

      if (!autoSync || !deviceNsec || !deviceNpub || relays.length === 0) {
        // Clean up any existing subscriptions if conditions aren't met
        await cleanupSubscriptions()
        return
      }

      let nostrApi: NostrAPI | null = null
      try {
        // Clean up any existing subscriptions before creating new ones
        await cleanupSubscriptions()

        nostrApi = new NostrAPI(relays)
        if (onLoadingChange) {
          nostrApi.setLoadingCallback(onLoadingChange)
        }
        await nostrApi.connect()
        activeSubscriptions.current.add(nostrApi)

        await nostrApi.subscribeToKind1059(
          deviceNsec as string,
          deviceNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Handle error silently
            }
          },
          undefined,
          lastDataExchangeEOSE,
          (nsec) => updateLasEOSETimestamp(account, nsec)
        )

        console.log('📝 Data exchange Subscription')
        if (lastDataExchangeEOSE > 0) {
          console.log(
            '📝 Data exchange since ',
            new Date(lastDataExchangeEOSE * 1000).toLocaleString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          )
        } else {
          console.log('📝 Data exchange since beginning')
        }
      } catch (_error) {
        toast.error('Failed to subscribe to data exchange')
        if (nostrApi) {
          await nostrApi.closeAllSubscriptions()
          activeSubscriptions.current.delete(nostrApi)
        }
      }
    },
    [processEvent, cleanupSubscriptions]
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
          created_at: Math.floor(Date.now() / 1000),
          label: 1,
          description: message
        }

        const compressedMessage = compressMessage(messageContent)

        nostrApi = new NostrAPI(relays)
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

        const eventKind1059 = await nostrApi.createKind1059(
          deviceNsec as string,
          deviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)

        const newDM: DM = {
          id: eventKind1059.id,
          author: deviceNpub,
          created_at: messageContent.created_at,
          description: message,
          event: JSON.stringify(eventKind1059),
          label: 1
        }

        const currentDms = account.nostr.dms || []
        const updatedDms = [...currentDms, newDM]
        updateAccountNostr(account.id, { dms: updatedDms })
      } catch (_error) {
        toast.error('Failed to send message')
      }
    },
    [updateAccountNostr]
  )

  const loadStoredDMs = useCallback(async (account?: Account) => {
    if (!account) return []
    if (!account.nostr) return []

    if (!account.nostr.dms) {
      account.nostr.dms = []
    }

    return account.nostr.dms
  }, [])

  const clearStoredDMs = useCallback(
    async (account?: Account) => {
      if (!account?.nostr) return
      updateAccountNostr(account.id, { dms: [] })
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
    const timestamp = Math.floor(Date.now() / 1000)
    if (nsec === account.nostr.commonNsec) {
      useNostrStore.getState().setLastProtocolEOSE(account.id, timestamp)
      console.log('🥸 🔴 Protocol since ', timestamp)
    } else if (nsec === account.nostr.deviceNsec) {
      useNostrStore.getState().setLastDataExchangeEOSE(account.id, timestamp)
      console.log('📝 🔴 Data exchange since ', timestamp)
    }
  }

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
    addProcessedMessageId: useNostrStore.getState().addProcessedEvent
  }
}

export default useNostrSync
