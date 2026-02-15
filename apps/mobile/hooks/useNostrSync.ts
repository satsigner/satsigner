import { type Network } from 'bdk-rn/lib/lib/enums'
import { nip19 } from 'nostr-tools'
import { useCallback } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { NostrAPI } from '@/api/nostr'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import type { Account, Secret } from '@/types/models/Account'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import {
  formatAccountLabels,
  JSONLtoLabels,
  type Label,
  labelsToJSONL
} from '@/utils/bip329'
import { sha256 } from '@/utils/crypto'
import {
  compressMessage,
  decompressMessage,
  deriveNostrKeysFromDescriptor
} from '@/utils/nostr'

function useNostrSync() {
  const [accounts, updateAccountNostr, importLabels] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.updateAccountNostr,
      state.importLabels
    ])
  )
  const [
    addMember,
    addSubscription,
    addProcessedEvent,
    clearSubscriptions,
    getActiveSubscriptions,
    getLastDataExchangeEOSE,
    getLastProtocolEOSE,
    setLastProtocolEOSE,
    setLastDataExchangeEOSE,
    processedEvents
  ] = useNostrStore(
    useShallow((state) => [
      state.addMember,
      state.addSubscription,
      state.addProcessedEvent,
      state.clearSubscriptions,
      state.getActiveSubscriptions,
      state.getLastDataExchangeEOSE,
      state.getLastProtocolEOSE,
      state.setLastProtocolEOSE,
      state.setLastDataExchangeEOSE,
      state.processedEvents
    ])
  )
  const cleanupSubscriptions = useCallback(async () => {
    const apisToCleanup = Array.from(getActiveSubscriptions())
    clearSubscriptions()
    for (const api of apisToCleanup) {
      try {
        await api.closeAllSubscriptions()
      } catch {
        toast.error(
          'Failed to clean subscription for: ' + api.getRelays().join(', ')
        )
      }
    }
  }, [clearSubscriptions, getActiveSubscriptions])

  const storeDM = useCallback(
    async (account?: Account, unwrappedEvent?: any, eventContent?: any) => {
      if (!account || !unwrappedEvent) return

      if (eventContent.created_at > Date.now() / 1000 + 60 * 5) {
        return
      }

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
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0
      if (
        eventContent.created_at > lastDataExchangeEOSE &&
        account.nostr.deviceNpub !== nip19.npubEncode(unwrappedEvent.pubkey) &&
        eventContent.created_at < Date.now() / 1000 - 60 * 5
      ) {
        const npub = nip19.npubEncode(unwrappedEvent.pubkey)
        const formatedAuthor = npub.slice(0, 12) + '...' + npub.slice(-4)
        toast.info(formatedAuthor + ': ' + eventContent.description)
      }

      // Get the current state directly from the store to ensure we have the latest
      const currentAccount = accounts.find((a: Account) => a.id === account.id)
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
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // TODO: update type
  function getEventContent(unwrappedEvent: any) {
    try {
      return JSON.parse(unwrappedEvent.content)
    } catch {}
    try {
      return decompressMessage(unwrappedEvent.content)
    } catch {}
    return unwrappedEvent.content
  }

  // TODO: update type
  const processEvent = useCallback(
    async (account: Account, unwrappedEvent: any): Promise<string> => {
      // Check for processed events at the very beginning
      const accountProcessedEvejts = processedEvents[account.id] || []
      if (accountProcessedEvejts.includes(unwrappedEvent.id)) {
        return ''
      }

      // Mark event as processed immediately to prevent duplicate processing
      addProcessedEvent(account.id, unwrappedEvent.id)

      const eventContent = getEventContent(unwrappedEvent)

      if (eventContent.data) {
        const data_type = eventContent.data.data_type
        if (data_type === 'LabelsBip329') {
          const labels = JSONLtoLabels(eventContent.data.data)
          const labelsAdded = importLabels(account.id, labels)
          if (labelsAdded > 0) {
            toast.success(`Imported ${labelsAdded} labels`)
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
          const psbtEventContent = {
            created_at:
              eventContent.created_at || Math.floor(Date.now() / 1000),
            description: eventContent.data.data
          }
          await storeDM(account, unwrappedEvent, psbtEventContent)
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
        //ignore if is sent to commonNpub
        if (
          account.nostr.commonNpub !==
          nip19.npubEncode(unwrappedEvent.tags[0][1])
        ) {
          await storeDM(account, unwrappedEvent, eventContent)
        }
      } else if (eventContent.public_key_bech32) {
        const newMember = eventContent.public_key_bech32
        addMember(account.id, newMember)
      }

      return eventContent
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const protocolSubscription = useCallback(
    async (account: Account, onLoadingChange?: (loading: boolean) => void) => {
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
        async (message) => processEvent(account, message.content),
        undefined,
        lastProtocolEOSE,
        (nsec) => updateLasEOSETimestamp(account, nsec)
      )
      return nostrApi
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const dataExchangeSubscription = useCallback(
    async (account: Account, onLoadingChange?: (loading: boolean) => void) => {
      const { autoSync, deviceNsec, deviceNpub, relays } = account.nostr
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0

      if (!autoSync || !deviceNsec || !deviceNpub || relays.length === 0) {
        return null
      }

      let nostrApi: NostrAPI | null = null
      nostrApi = new NostrAPI(relays)
      if (onLoadingChange) {
        nostrApi.setLoadingCallback(onLoadingChange)
      }
      await nostrApi.connect()
      await nostrApi.subscribeToKind1059(
        deviceNsec as string,
        deviceNpub as string,
        async (message) => processEvent(account, message.content),
        undefined,
        lastDataExchangeEOSE,
        (nsec) => updateLasEOSETimestamp(account, nsec)
      )
      return nostrApi
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
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
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const sendLabelsToNostr = async (account?: Account, singleLabel?: Label) => {
    if (!account || !account.nostr || !account.nostr.autoSync) {
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
    const trustedDevices =
      accounts.find((a) => a.id === account.id)?.nostr?.trustedMemberDevices ||
      []

    for (const trustedDeviceNpub of trustedDevices) {
      if (!deviceNsec) continue
      const eventKind1059 = await nostrApi.createKind1059(
        deviceNsec,
        trustedDeviceNpub,
        compressedMessage
      )
      await nostrApi.publishEvent(eventKind1059)
    }
  }

  async function loadStoredDMs(account?: Account) {
    if (!account) return []
    return account.nostr?.dms || []
  }

  const clearStoredDMs = useCallback(
    async (account?: Account) => {
      if (!account?.nostr) return
      updateAccountNostr(account.id, {
        ...account.nostr,
        dms: []
      })
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  async function generateCommonNostrKeys(account?: Account) {
    if (!account) return

    const isImportAddress = account.keys[0].creationType === 'importAddress'
    const tmpAccount = await getAccountWithDecryptedKeys(account)
    if (isImportAddress) {
      const secret = tmpAccount.keys[0].secret as Secret
      return {
        externalDescriptor: secret.externalDescriptor,
        internalDescriptor: undefined
      }
    }

    const walletData = await getWalletData(
      tmpAccount,
      tmpAccount.network as Network
    )
    if (!walletData) {
      throw new Error('Failed to get wallet data')
    }

    return deriveNostrKeysFromDescriptor(walletData.externalDescriptor)
  }

  function updateLasEOSETimestamp(account: Account, nsec: string) {
    const timestamp = Math.floor(Date.now() / 1000) - 3600 // Subtract 1 hour
    if (nsec === account.nostr.commonNsec) {
      setLastProtocolEOSE(account.id, timestamp)
    } else if (nsec === account.nostr.deviceNsec) {
      setLastDataExchangeEOSE(account.id, timestamp)
    }
  }

  const deviceAnnouncement = useCallback(async (account?: Account) => {
    if (!account?.nostr?.autoSync) return
    if (!account || !account.nostr) return
    const { commonNsec, commonNpub, deviceNpub, relays } = account.nostr

    if (!commonNsec || !commonNpub || relays.length === 0 || !deviceNpub) {
      toast.error('Missing required Nostr configuration')
      return
    }

    const messageContent = {
      created_at: Math.floor(Date.now() / 1000),
      public_key_bech32: deviceNpub
    }

    const compressedMessage = compressMessage(messageContent)
    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    const eventKind1059 = await nostrApi.createKind1059(
      commonNsec,
      commonNpub,
      compressedMessage
    )
    await nostrApi.publishEvent(eventKind1059)
  }, [])

  return {
    sendLabelsToNostr,
    dataExchangeSubscription,
    generateCommonNostrKeys,
    storeDM,
    loadStoredDMs,
    clearStoredDMs,
    processEvent,
    protocolSubscription,
    cleanupSubscriptions,
    deviceAnnouncement,
    nostrSyncSubscriptions,
    getActiveSubscriptions
  }
}

export default useNostrSync
