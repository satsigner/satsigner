import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'
import { formatAccountLabels, labelsToJSONL } from '@/utils/bip329'

function useNostrLabelSync() {
  const sendAccountLabelsToNostr = async (account: Account) => {
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

  return {
    sendAccountLabelsToNostr
  }
}

export default useNostrLabelSync
