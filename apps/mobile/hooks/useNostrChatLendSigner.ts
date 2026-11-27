import { useState } from 'react'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_NIP46_OFFER_TTL_MS } from '@/constants/nostr'
import { MS_PER_MINUTE } from '@/constants/time'
import { startNip46Session } from '@/hooks/useNip46SessionManager'
import { t } from '@/locales'
import { stopNip46Session } from '@/services/nip46Sessions'
import { useNip46Store } from '@/store/nip46'
import { buildBunkerOfferTags, createBunkerOffer } from '@/utils/nip46Bunker'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getChatPipelineApi, sendNip17Chat } from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'
import { isNonEmptyString } from '@/utils/string'

type LendIdentity = {
  isWatchOnly?: boolean
  npub: string
  nsec?: string
  relays?: string[]
}

type LendTarget = {
  identity: LendIdentity | undefined
  peerNpub: string
  peerPubkey: string | null
  sessionId: string
}

const OFFER_TTL_MINUTES = NOSTR_NIP46_OFFER_TTL_MS / MS_PER_MINUTE

/**
 * Lends the chat identity as a live NIP-46 signer to the peer of one
 * session: a single-use `bunker://` link, sent in that session. Every
 * request it receives still goes through the approval prompt.
 */
export function useNostrChatLendSigner({
  identity,
  peerNpub,
  peerPubkey,
  sessionId
}: LendTarget) {
  const [lending, setLending] = useState(false)
  const nsec = identity?.nsec
  const canLend =
    identity !== undefined &&
    identity.isWatchOnly !== true &&
    isNonEmptyString(nsec) &&
    peerPubkey !== null

  async function lend() {
    const signerPubkeyHex = identity
      ? getPubKeyHexFromNpub(identity.npub)
      : null
    if (
      !canLend ||
      !identity ||
      !isNonEmptyString(nsec) ||
      signerPubkeyHex === null ||
      lending
    ) {
      return
    }
    setLending(true)
    const relays = getNostrContactsRelays(identity.relays)
    const offer = createBunkerOffer({
      nowMs: Date.now(),
      origin: { kind: 'chat', peerPubkey: peerPubkey ?? '', sessionId },
      relays,
      signerNpub: identity.npub,
      signerPubkeyHex
    })
    const store = useNip46Store.getState()
    const session = store.addSession(offer.session)
    const pipelineApi = getChatPipelineApi(identity.npub)
    const api = pipelineApi ?? new NostrAPI(relays)
    const failure = await startNip46Session(session, nsec)
      .then(() =>
        sendNip17Chat(
          api,
          { npub: identity.npub, nsec, relays: identity.relays },
          peerNpub,
          t('nip46.lend.message', {
            minutes: OFFER_TTL_MINUTES,
            url: offer.url
          }),
          { extraTags: buildBunkerOfferTags(offer.url), sessionId }
        )
      )
      .then(
        () => null,
        (error: unknown) => ({ error })
      )
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
    setLending(false)
    if (failure) {
      stopNip46Session(session.id)
      store.removeSession(session.id)
      toast.error(getNostrErrorMessage(failure.error))
      return
    }
    toast.success(t('nip46.lend.sent', { minutes: OFFER_TTL_MINUTES }))
  }

  return { canLend, lend, lending }
}
