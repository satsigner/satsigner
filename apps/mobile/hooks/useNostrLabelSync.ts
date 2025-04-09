import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'

function useNostrLabelSync() {
  const sendAccountLabelsToNostr = (account: Account) => {
    const { autoSync, seckey, npub, relays } = account.nostr

    if (!autoSync || !seckey || npub === '' || relays.length === 0) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    nostrApi.sendLabelsToNostr(seckey, npub, account)
  }

  return {
    sendAccountLabelsToNostr
  }
}

export default useNostrLabelSync
