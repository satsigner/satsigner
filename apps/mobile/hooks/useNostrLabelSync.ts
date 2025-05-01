import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import { getWalletData } from '@/api/bdk'
import { PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import type { Account, Secret } from '@/types/models/Account'
import { type Network } from 'bdk-rn/lib/lib/enums'
import {
  formatAccountLabels,
  JSONLtoLabels,
  type Label,
  labelsToJSONL
} from '@/utils/bip329'
import { aesDecrypt, sha256 } from '@/utils/crypto'
import { getPublicKey, nip19 } from 'nostr-tools'

function useNostrLabelSync() {
  const [importLabels, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [state.importLabels, state.updateAccountNostr])
  )

  async function sendAccountLabelsToNostr(account?: Account) {
    if (!account?.nostr?.autoSync) {
      console.log('Auto sync is disabled')
      return
    }
    if (!account || !account.nostr) {
      console.log('Account or nostr data is missing')
      return
    }
    const { nsec, npub, relays, lastBackupFingerprint } = account.nostr

    if (!nsec || npub === '' || relays.length === 0) {
      console.log('Missing required nostr data:', {
        nsec: !!nsec,
        npub: !!npub,
        relaysCount: relays.length
      })
      return
    }

    const labels = formatAccountLabels(account)
    console.log('Formatted labels count:', labels.length)

    if (labels.length === 0) {
      console.log('No labels to send')
      return
    }

    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)
    console.log('Message fingerprint:', fingerprint)
    console.log('Last backup fingerprint:', lastBackupFingerprint)

    if (fingerprint === lastBackupFingerprint) {
      console.log('Labels unchanged, skipping send')
      return
    }

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()
    console.log('Connected to relays:', relays)

    try {
      console.log('Sending message to relays...')
      await nostrApi.sendMessage(nsec, npub, message)
      console.log('Message sent successfully')

      const timestamp = new Date().getTime() / 1000
      updateAccountNostr(account.id, {
        lastBackupFingerprint: fingerprint,
        lastBackupTimestamp: timestamp
      })
      console.log('Updated backup timestamp:', timestamp)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      await nostrApi.disconnect()
      console.log('Disconnected from relays')
    }
  }

  // Sync last backup found
  async function syncAccountLabelsFromNostr(account?: Account) {
    if (!account || !account.nostr) return

    const { autoSync, nsec, npub, relays, lastBackupTimestamp } = account.nostr

    if (!autoSync || !nsec || !npub || relays.length === 1) return
    const nostrApi = new NostrAPI(relays)

    const messageCount = 5
    const since = lastBackupTimestamp
    const messages = await nostrApi.fetchMessages(
      nsec,
      npub,
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
      const nsec = nip19.nsecEncode(privateKeyBytes)
      const npub = nip19.npubEncode(publicKey)

      const keys = { nsec, npub, privateKeyBytes }
      return {
        nsec,
        npub,
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
