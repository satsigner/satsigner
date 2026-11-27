import { useQuery } from '@tanstack/react-query'

import { getChatSessionState } from '@/db/queries/nostrChat'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { useNow } from '@/hooks/useNow'
import type { NostrChatProtocol } from '@/types/models/Nostr'
import { nostrChatQueryKeys } from '@/utils/nostrChat'
import {
  buildSessionStateRows,
  buildSessionStateSummary
} from '@/utils/nostrChatAgent'
import { isNonEmptyString } from '@/utils/string'

type SessionStateTarget = {
  identityNpub: string | undefined
  peerPubkey: string | null
  protocol: NostrChatProtocol
  sessionId: string
}

/**
 * What the peer's agent last reported for this session: the header line and
 * the rows of its sheet. Nothing when the peer never sent a document, so an
 * ordinary contact's thread looks as before.
 */
export function useNostrChatSessionState({
  identityNpub,
  peerPubkey,
  protocol,
  sessionId
}: SessionStateTarget) {
  const display = useDisplayPreferences()
  const nowMs = useNow()
  const npub = identityNpub ?? ''
  const peer = peerPubkey ?? ''

  const { data: stored = null } = useQuery({
    enabled:
      isNonEmptyString(npub) && peerPubkey !== null && protocol === 'nip17',
    queryFn: () => getChatSessionState(npub, peer, sessionId, peer),
    queryKey: nostrChatQueryKeys.sessionState(npub, peer, sessionId)
  })

  if (!stored || protocol !== 'nip17') {
    return null
  }
  return {
    rows: buildSessionStateRows(stored, nowMs, display),
    sharedModel: stored.state.session?.sharedModel === true,
    summary: buildSessionStateSummary(stored, nowMs, display.privacyMode)
  }
}
