import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import {
  formatAccountLabels,
  JSONLtoLabels,
  type Label,
  labelsToJSONL
} from '@/utils/bip329'
import { sha256 } from '@/utils/crypto'

function useNostrLabelSync() {
  const [importLabels, updateAccount] = useAccountsStore(
    useShallow((state) => [state.importLabels, state.updateAccount])
  )

  async function sendAccountLabelsToNostr(account?: Account) {
    if (!account || !account.nostr) return

    const { autoSync, seckey, npub, relays, lastBackupFingerprint } =
      account.nostr

    if (!autoSync || !seckey || npub === '' || relays.length === 0) {
      return
    }

    const labels = formatAccountLabels(account)

    if (labels.length === 0) return

    const message = labelsToJSONL(labels)
    const hash = await sha256(message)
    const fingerprint = hash.slice(0, 8)

    if (fingerprint === lastBackupFingerprint) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()
    await nostrApi.sendMessage(Uint8Array.from(seckey), npub, message)
    await nostrApi.disconnect()

    const timestamp = new Date().getTime() / 1000

    updateAccount({
      ...account,
      nostr: {
        ...account.nostr,
        lastBackupFingerprint: fingerprint,
        lastBackupTimestamp: timestamp
      }
    })
  }

  // Sync last backup found
  async function syncAccountLabelsFromNostr(account?: Account) {
    if (!account || !account.nostr) return

    const { autoSync, seckey, npub, relays, lastBackupTimestamp } =
      account.nostr

    if (!autoSync || !seckey || npub === '' || relays.length === 0) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    const messageCount = 5
    const since = undefined // lastBackupTimestamp
    const messages = await nostrApi.fetchMessages(
      Uint8Array.from(seckey),
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

  return {
    sendAccountLabelsToNostr,
    syncAccountLabelsFromNostr
  }
}

export default useNostrLabelSync
