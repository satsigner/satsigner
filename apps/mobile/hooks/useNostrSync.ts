import { type Network } from 'bdk-rn/lib/lib/enums'
import { nip19 } from 'nostr-tools'
import { useCallback } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { NostrAPI } from '@/api/nostr'
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
import {
  compressMessage,
  decompressMessage,
  deriveNostrKeysFromDescriptor
} from '@/utils/nostr'

type UnwrappedNostrEvent = {
  id: string
  pubkey: string
  content: string
  created_at?: number
  tags?: unknown[][]
}

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
    async (
      account?: Account,
      unwrappedEvent?: UnwrappedNostrEvent,
      eventContent?: Record<string, unknown>
    ) => {
      if (!account || !unwrappedEvent || !eventContent) return

      const created_at = eventContent.created_at as number
      if (created_at > Date.now() / 1000 + 60 * 5) return
      const description = (eventContent.description as string) ?? ''
      const newMessage = {
        id: unwrappedEvent.id,
        author: unwrappedEvent.pubkey,
        created_at,
        description,
        event: JSON.stringify(unwrappedEvent),
        label: 1,
        content: {
          description,
          created_at,
          pubkey: unwrappedEvent.pubkey
        }
      }

      // Trigger notifcation only if message is recent and is not sent to self
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0
      if (
        created_at > lastDataExchangeEOSE &&
        account.nostr.deviceNpub !== nip19.npubEncode(unwrappedEvent.pubkey) &&
        created_at < Date.now() / 1000 - 60 * 5
      ) {
        const npub = nip19.npubEncode(unwrappedEvent.pubkey)
        const formatedAuthor = npub.slice(0, 12) + '...' + npub.slice(-4)
        toast.info(`${formatedAuthor}: ${description}`)
      }

      // Get the current state directly from the store to ensure we have the latest
      const currentAccount = accounts.find((a) => a.id === account.id)
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

  type PendingDM = {
    unwrappedEvent: UnwrappedNostrEvent
    eventContent: Record<string, unknown>
  }

  function buildNewMessage(
    unwrappedEvent: UnwrappedNostrEvent,
    eventContent: Record<string, unknown>
  ) {
    const created_at = eventContent.created_at as number
    const description = (eventContent.description as string) ?? ''
    return {
      id: unwrappedEvent.id,
      author: unwrappedEvent.pubkey,
      created_at,
      description,
      event: JSON.stringify(unwrappedEvent),
      label: 1,
      content: {
        description,
        created_at,
        pubkey: unwrappedEvent.pubkey
      }
    }
  }

  const processEventBatch = useCallback(
    async (
      account: Account,
      messages: Array<{ id: string; content: unknown; created_at: number }>
    ): Promise<void> => {
      const pendingDms: PendingDM[] = []

      for (const msg of messages) {
        const unwrappedEvent = msg.content as UnwrappedNostrEvent
        const accountProcessedEvents = processedEvents[account.id]
        if (accountProcessedEvents?.[unwrappedEvent.id]) continue

        addProcessedEvent(account.id, unwrappedEvent.id)
        const eventContent = getEventContent(unwrappedEvent)

        const data = eventContent.data as
          | { data_type?: string; data?: unknown }
          | undefined
        if (data) {
          const data_type = data.data_type
          if (data_type === 'LabelsBip329') {
            const labels = JSONLtoLabels(String(data.data ?? ''))
            const labelsAdded = importLabels(account.id, labels)
            if (labelsAdded > 0) {
              toast.success(`Imported ${labelsAdded} labels`)
            }
          } else if (data_type === 'Tx') {
            const dataStr = String(data.data ?? '')
            toast.info(
              `New Tx Recieve from: ${nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12)}...${nip19.npubEncode(unwrappedEvent.pubkey).slice(-4)} - ${dataStr.slice(0, 12)}...`
            )
          } else if (data_type === 'PSBT') {
            const dataStr = String(data.data ?? '')
            toast.info(
              `New PSBT Recieve from: ${nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12)}...${nip19.npubEncode(unwrappedEvent.pubkey).slice(-4)} - ${dataStr.slice(0, 12)}...`
            )
            const psbtEventContent: Record<string, unknown> = {
              created_at:
                (eventContent.created_at as number) ||
                Math.floor(Date.now() / 1000),
              description: data.data
            }
            pendingDms.push({
              unwrappedEvent,
              eventContent: psbtEventContent
            })
          } else if (data_type === 'SignMessageRequest') {
            const dataStr = String(data.data ?? '')
            toast.info(
              `New Sign message request Recieve from: ${nip19.npubEncode(unwrappedEvent.pubkey).slice(0, 12)}...${nip19.npubEncode(unwrappedEvent.pubkey).slice(-4)} - ${dataStr.slice(0, 12)}...`
            )
          }
        } else if (
          eventContent.description != null &&
          eventContent.description !== '' &&
          !data
        ) {
          const tags = unwrappedEvent.tags
          if (
            tags?.[0]?.[1] != null &&
            account.nostr.commonNpub !== nip19.npubEncode(tags[0][1] as string)
          ) {
            pendingDms.push({ unwrappedEvent, eventContent })
          }
        } else if (eventContent.public_key_bech32) {
          const newMember = eventContent.public_key_bech32 as string
          addMember(account.id, newMember)
        }
      }

      if (pendingDms.length === 0) return

      const currentAccount = accounts.find((a) => a.id === account.id)
      if (!currentAccount?.nostr) return

      const currentDms = [...(currentAccount.nostr.dms || [])]
      const existingIds = new Set(currentDms.map((m) => m.id))
      const lastDataExchangeEOSE = getLastDataExchangeEOSE(account.id) || 0

      for (const { unwrappedEvent, eventContent } of pendingDms) {
        const created_at = eventContent.created_at as number
        if (created_at > Date.now() / 1000 + 60 * 5) continue

        const newMessage = buildNewMessage(unwrappedEvent, eventContent)
        if (existingIds.has(newMessage.id)) continue
        existingIds.add(newMessage.id)
        currentDms.push(newMessage)

        const description = (eventContent.description as string) ?? ''
        if (
          created_at > lastDataExchangeEOSE &&
          account.nostr.deviceNpub !== nip19.npubEncode(unwrappedEvent.pubkey) &&
          created_at < Date.now() / 1000 - 60 * 5
        ) {
          const npub = nip19.npubEncode(unwrappedEvent.pubkey)
          const formatedAuthor = npub.slice(0, 12) + '...' + npub.slice(-4)
          toast.info(`${formatedAuthor}: ${description}`)
        }
      }

      const updatedDms = currentDms.sort((a, b) => a.created_at - b.created_at)
      updateAccountNostr(account.id, { dms: updatedDms })
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const processEvent = useCallback(
    async (
      account: Account,
      unwrappedEvent: UnwrappedNostrEvent
    ): Promise<void> => {
      await processEventBatch(account, [
        {
          id: unwrappedEvent.id,
          content: unwrappedEvent,
          created_at: unwrappedEvent.created_at ?? 0
        }
      ])
    },
    [processEventBatch]
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
        (messages) => processEventBatch(account, messages),
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
        (messages) => processEventBatch(account, messages),
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
      if (!account || !account.nostr) return

      if (getActiveSubscriptions().size > 0) return

      await cleanupSubscriptions()

      const protocolApi = await protocolSubscription(account, onLoadingChange)
      if (protocolApi) {
        addSubscription(protocolApi)
      }

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
    if (!account || !account.nostr || !account.nostr.autoSync) return
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
      // Only update dms so we never overwrite device keys (e.g. from stale account ref)
      updateAccountNostr(account.id, { dms: [] })
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const generateCommonNostrKeys = useCallback(async (account?: Account) => {
    if (!account) return

    const pin = await getItem(PIN_KEY)
    if (!pin) return

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

    return deriveNostrKeysFromDescriptor(walletData.externalDescriptor)
  }, [])

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
