import { type Network } from 'bdk-rn/lib/lib/enums'
import { getPublicKey, nip19 } from 'nostr-tools'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { NostrAPI } from '@/api/nostr'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import type { Account, Secret } from '@/types/models/Account'
import {
  formatAccountLabels,
  JSONLtoLabels,
  type Label,
  labelsToJSONL
} from '@/utils/bip329'
import { aesDecrypt, sha256 } from '@/utils/crypto'

function useNostrLabelSync() {
  const [importLabels, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [state.importLabels, state.updateAccountNostr])
  )

  async function sendAccountLabelsToNostr(account?: Account) {
    if (!account?.nostr?.autoSync) {
      return
    }
    if (!account || !account.nostr) {
      return
    }
    const { commonNsec, commonNpub, relays, lastBackupFingerprint } =
      account.nostr

    if (!commonNsec || commonNpub === '' || relays.length === 0) {
      return
    }

    const labels = formatAccountLabels(account)

    if (labels.length === 0) {
      toast.error('No labels to send')
      return
    }

    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)

    if (fingerprint === lastBackupFingerprint) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    try {
      toast.info('Sending message to relays...')
      const event = await nostrApi.createKind1059WrappedEvent(
        commonNsec,
        commonNpub,
        message
      )
      await nostrApi.sendMessage(event)
      toast.success('Message sent successfully')

      const timestamp = new Date().getTime() / 1000
      updateAccountNostr(account.id, {
        lastBackupFingerprint: fingerprint,
        lastBackupTimestamp: timestamp
      })
    } catch (_error) {
      toast.error('Failed to send message')
    } finally {
      await nostrApi.disconnect()
    }
  }

  // Sync last backup found
  async function syncAccountLabelsFromNostr(account?: Account) {
    if (!account || !account.nostr) return

    const { autoSync, commonNsec, commonNpub, relays, lastBackupTimestamp } =
      account.nostr

    if (!autoSync || !commonNsec || !commonNpub || relays.length === 1) return
    const nostrApi = new NostrAPI(relays)

    const messageCount = 5
    const since = lastBackupTimestamp
    const messages = await nostrApi.fetchMessages(
      commonNsec,
      commonNpub,
      since,
      messageCount
    )

    await nostrApi.disconnect()

    const labels: Label[] = []
    for (const message of messages) {
      try {
        if (!message.decryptedContent) continue
        labels.push(...JSONLtoLabels(message.decryptedContent))
      } catch {
        //
      }
    }

    if (labels.length === 0) return

    importLabels(account.id, labels)
  }

  async function generateCommonNostrKeys(account?: Account) {
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
  }

  return {
    sendAccountLabelsToNostr,
    syncAccountLabelsFromNostr,

    generateCommonNostrKeys
  }
}

export default useNostrLabelSync
