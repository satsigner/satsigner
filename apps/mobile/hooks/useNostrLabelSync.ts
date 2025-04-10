import { NostrAPI } from '@/api/nostr'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import {
  formatAccountLabels,
  JSONLtoLabels,
  Label,
  labelsToJSONL
} from '@/utils/bip329'

function useNostrLabelSync() {
  const importLabels = useAccountsStore((state) => state.importLabels)

  async function sendAccountLabelsToNostr(account: Account) {
    const { autoSync, seckey, npub, relays } = account.nostr

    if (!autoSync || !seckey || npub === '' || relays.length === 0) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    const labels = formatAccountLabels(account)
    const message = labelsToJSONL(labels)
    await nostrApi.connect()
    await nostrApi.sendMessage(seckey, npub, message)
    await nostrApi.disconnect()
  }

  // Sync last backup found
  async function syncAccountLabelsFromNostr(account: Account) {
    const { autoSync, seckey, npub, relays } = account.nostr

    if (!autoSync || !seckey || npub === '' || relays.length === 0) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    await nostrApi.connect()

    const messageCount = 10
    const since = undefined
    const messages = await nostrApi.fetchMessages(
      seckey,
      npub,
      since,
      messageCount
    )

    await nostrApi.disconnect()

    const labels: Label[] = []
    for (const message of messages) {
      try {
        labels.push(...JSONLtoLabels(message.content))
        break
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
