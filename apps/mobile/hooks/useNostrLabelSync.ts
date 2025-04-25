import { useShallow } from 'zustand/react/shallow'

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
    if (!account || !account.nostr) return

    const { nsec, npub, relays, lastBackupFingerprint } = account.nostr

    if (!nsec || npub === '' || relays.length === 0) return

    const labels = formatAccountLabels(account)

    if (labels.length === 0) return

    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)

    if (fingerprint === lastBackupFingerprint) return

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    try {
      await nostrApi.sendMessage(nsec, npub, message)

      const timestamp = new Date().getTime() / 1000

      updateAccountNostr(account.id, {
        lastBackupFingerprint: fingerprint,
        lastBackupTimestamp: timestamp
      })
    } catch {
      //
    } finally {
      await nostrApi.disconnect()
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

  async function generateAccountNostrKeys(account?: Account, passphrase = '') {
    if (!account || !account.nostr) {
      throw new Error('undefined account')
    }

    const pin = await getItem(PIN_KEY)
    if (!pin) {
      throw new Error('PIN not found')
    }

    // Get IV and encrypted secret from account
    const iv = account.keys[0].iv
    const encryptedSecret = account.keys[0].secret as string

    // Decrypt the secret
    const accountSecretString = await aesDecrypt(encryptedSecret, pin, iv)
    const accountSecret = JSON.parse(accountSecretString) as Secret
    const mnemonic = accountSecret.mnemonic

    if (!mnemonic) {
      throw new Error('invalid mnemonic')
    }

    const keys = await NostrAPI.generateNostrKeys(mnemonic, passphrase)
    return keys
  }

  return {
    sendAccountLabelsToNostr,
    syncAccountLabelsFromNostr,
    generateAccountNostrKeys
  }
}

export default useNostrLabelSync
