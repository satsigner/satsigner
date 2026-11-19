import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import type { ChatIdentity } from '@/utils/nostrChat'
import {
  getChatPipelineApi,
  removeChatReactions,
  sendChatReaction
} from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { isNonEmptyString } from '@/utils/string'

/** Watch-only identities have no nsec and can't react. */
type ReactingIdentity = { npub: string; nsec?: string; relays?: string[] }

/** Runs a reaction publish on the warm chat pipeline, or a short-lived API. */
async function withChatApi(
  identity: ChatIdentity,
  publish: (api: NostrAPI) => Promise<void>
): Promise<void> {
  const pipelineApi = getChatPipelineApi(identity.npub)
  const api =
    pipelineApi ?? new NostrAPI(getNostrContactsRelays(identity.relays))
  try {
    await publish(api)
  } catch (error) {
    toast.error(getNostrErrorMessage(error))
  } finally {
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
  }
}

function toSigningIdentity(
  identity: ReactingIdentity | undefined
): ChatIdentity | null {
  if (!identity || !isNonEmptyString(identity.nsec)) {
    return null
  }
  return { npub: identity.npub, nsec: identity.nsec, relays: identity.relays }
}

/** Adding and taking back my reactions in a NIP-17 thread. */
function useNostrChatReactions(
  identity: ReactingIdentity | undefined,
  peerNpub: string
) {
  const signer = toSigningIdentity(identity)

  function react(messageId: string, emoji: string) {
    if (!signer) {
      return
    }
    void withChatApi(signer, (api) =>
      sendChatReaction(api, signer, peerNpub, messageId, emoji)
    )
  }

  function unreact(reactionIds: string[]) {
    if (!signer) {
      return
    }
    void withChatApi(signer, (api) =>
      removeChatReactions(api, signer, peerNpub, reactionIds)
    )
  }

  return { canReact: signer !== null, react, unreact }
}

export { useNostrChatReactions }
