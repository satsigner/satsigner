import { NostrAPI } from '@/api/nostr'
import { type Account } from '@/types/models/Account'

function useNostrLabelSync() {
  const sendAccountLabelsToNostr = (account: Account) => {
    const { autoSync, seckey, pubkey, relays } = account.nostr

    if (!autoSync || !seckey || pubkey === '' || relays.length === 0) {
      return
    }

    const nostrApi = new NostrAPI(relays)
    nostrApi.sendLabelsToNostr(seckey, pubkey, account)
  }

  return {
    sendAccountLabelsToNostr
  }
}

export default useNostrLabelSync
