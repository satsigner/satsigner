import { type Network } from 'bdk-rn/lib/lib/enums'
import { getPublicKey, nip19 } from 'nostr-tools'
import { toast } from 'sonner-native'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { NostrAPI, decompressMessage, compressMessage } from '@/api/nostr'
import { PIN_KEY } from '@/config/auth'
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
import { t } from '@/locales'

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
        created_at: Date.now() / 1000,
        description: message.description,
        event: JSON.stringify(unwrappedEvent),
        label: 1
      }

      // Create a new array with the existing DMs plus the new one
      const updatedDms = [...(account.nostr.dms || []), newDM]

      // Update the store directly with the new array
      updateAccountNostr(account.id, { dms: updatedDms })
    },
    [updateAccountNostr]
  )

  /*
  





  PROCESS EVENTS
  




  */
  const processEvent = useCallback(
    async (account: Account, unwrappedEvent: any): Promise<string> => {
      // Check if event has already been processed
      const processedEvents = useNostrStore
        .getState()
        .getProcessedEvents(account.id)
      if (processedEvents.includes(unwrappedEvent.id)) {
        return ''
      }

      let eventContent: any
      try {
        // Not compressed
        const jsonContent = JSON.parse(unwrappedEvent.content)
        eventContent = jsonContent
      } catch (_jsonError) {
        // Compressed
        try {
          eventContent = decompressMessage(unwrappedEvent.content)
        } catch (_decompressError) {
          eventContent = unwrappedEvent.content
        }
      }

      if (eventContent.data) {
        const data_type = eventContent.data.data_type
        if (data_type === 'LabelsBip329') {
          // Handle LabelsBip329
          console.log('⚠️ LABELS ', eventContent.data.data.slice(0, 300))
          try {
            if (
              eventContent.data.data.length === 1 &&
              eventContent.data.data[0].type === 'tx'
            ) {
              const label = eventContent.data.data[0].label
              const txid = eventContent.data.data[0].ref
              setTxLabel(account.id, txid, label)
            } else {
              const labels = JSONLtoLabels(eventContent.data.data)
              const importCount = useAccountsStore
                .getState()
                .importLabels(account.id, labels)
            }
            if (importCount > 0) {
              toast.success(`Imported ${importCount} labels`)
            }
          } catch (error) {
            console.error('Failed to import labels:', error)
            toast.error('Failed to import labels')
          }
        } else if (data_type === 'Tx') {
          // Handle Tx
        } else if (data_type === 'PSBT') {
          // Handle PSBT
          // POPUP Sing prompt
        }
      } else if (eventContent.description && !eventContent.data) {
        // Store message on nostr store
        await storeDM(account, unwrappedEvent)
        console.log('🟢 DM stored')
      } else if (eventContent.public_key_bech32) {
        // Handle protocol event
        console.log('🥸 PROTOCOL EVENT')
        const newMember = eventContent.public_key_bech32
        await addMember(account.id, newMember)
      }

      // Mark event as processed
      useNostrStore.getState().addProcessedEvent(account.id, unwrappedEvent.id)

      return eventContent
    },
    [storeDM, addMember]
  )

  const protocolSubscription = useCallback(
    async (account?: Account) => {
      if (!account || !account.nostr) return
      console.log('🟣 PROTOCOL SUBSCRIPTION')
      const { autoSync, commonNsec, commonNpub, relays } = account.nostr

      if (!autoSync || !commonNsec || !commonNpub || relays.length === 0) return

      let nostrApi: NostrAPI | null = null
      try {
        nostrApi = new NostrAPI(relays)
        await nostrApi.connect()

        // Subscribe to kind 1059 messages
        await nostrApi.subscribeToKind1059(
          commonNsec as string,
          commonNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Handle error silently
            }
          }
        )
      } catch (_error) {
        toast.error('Failed to subscribe to protocol events')
      }
    },
    [processEvent]
  )

  const dataExchangeSubscription = useCallback(
    async (account?: Account) => {
      if (!account || !account.nostr) return
      console.log('🩸 DATA EXCHANGE SUBSCRIPTION')
      const { autoSync, deviceNsec, deviceNpub, relays } = account.nostr

      if (!autoSync || !deviceNsec || !deviceNpub || relays.length === 0) return

      let nostrApi: NostrAPI | null = null
      try {
        nostrApi = new NostrAPI(relays)
        await nostrApi.subscribeToKind1059(
          deviceNsec as string,
          deviceNpub as string,
          async (message) => {
            try {
              await processEvent(account, message.content)
            } catch (_error) {
              // Handle error silently
            }
          }
        )
      } catch (_error) {
        toast.error('Failed to subscribe to data exchange')
      }
    },
    [processEvent]
  )

  const sendLabelsToNostr = useCallback(
    async (account?: Account, singleLabel?: any) => {
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

        // Format each label entry and wrap in labelPackage
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

        // Send labels to all trusted devices
        const deviceNsec = account.nostr.deviceNsec
        // Get all trusted devices for this account
        const trustedDevices = getTrustedDevices(account.id)

        // Send to each trusted device
        for (const trustedDeviceNpub of trustedDevices) {
          if (!deviceNsec) continue
          const eventKind1059 = await nostrApi.createKind1059(
            deviceNsec,
            trustedDeviceNpub,
            compressedMessage
          )
          await nostrApi.publishEvent(eventKind1059)
        }

        if (singleLabel) {
          toast.success('Single label sent to relays')
        } else {
          toast.success('All labels sent to relays')
        }

        // Update last backup timestamp
        const timestamp = Math.floor(Date.now() / 1000)
        updateAccountNostr(account.id, {
          lastBackupTimestamp: timestamp
        })
      } catch (_error) {
        toast.error('Failed to send message')
      }
    },
    [updateAccountNostr]
  )

  /*
  
  SEND DM
  
  */

  const sendDM = useCallback(
    async (account?: Account, message?: any) => {
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
        // Get all trusted devices for this account
        const trustedDevices = getTrustedDevices(account.id)

        // Send to each trusted device
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
          deviceNsec,
          deviceNpub,
          compressedMessage
        )
        await nostrApi.publishEvent(eventKind1059)

        // Update last backup timestamp
        const timestamp = Math.floor(Date.now() / 1000)
        updateAccountNostr(account.id, {
          lastBackupTimestamp: timestamp
        })
      } catch (_error) {
        toast.error('Failed to send message')
      }
    },
    [updateAccountNostr]
  )

  const loadStoredDMs = useCallback(async (account?: Account) => {
    if (!account) return []
    if (!account.nostr) return []

    // Initialize dms array if it doesn't exist
    if (!account.nostr.dms) {
      account.nostr.dms = []
    }

    //console.log(account.nostr.dms)

    console.log('Total DMs in store:', account.nostr.dms.length)

    return account.nostr.dms
  }, [])

  const clearStoredDMs = useCallback(
    async (account?: Account) => {
      if (!account?.nostr) return

      // Clear the DMs array in the store
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
      // Extract hardened derivation path from descriptor
      const descriptor = walletData.externalDescriptor
      const match = descriptor.match(/\[([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\]/)
      if (!match) {
        throw new Error('Invalid descriptor format')
      }
      const [, , purpose, coinType, accountIndex] = match
      // Convert apostrophe to 'h' for hardened paths
      const hardenedPath = `m/${purpose.replace("'", 'h')}/${coinType.replace("'", 'h')}/${accountIndex.replace("'", 'h')}`

      // Extract all xpubs from descriptor and sort them
      const xpubRegex = /(tpub|vpub|upub|zpub)[a-zA-Z0-9]+/g
      const xpubs = (descriptor.match(xpubRegex) || []).sort()

      // Concatenate hardened path with sorted xpubs
      const totalString = hardenedPath + xpubs.join('')

      // Calculate double hash of totalString
      const firstHash = await sha256(totalString)
      const doubleHash = await sha256(firstHash)

      // Generate Nostr keys using doubleHash as private key
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
    addProcessedMessageId: useNostrStore.getState().addProcessedEvent
  }
}

export default useNostrSync
