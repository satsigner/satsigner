import { useFocusEffect } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useEffectEvent, useState } from 'react'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CHAT_PROFILE_RETRY_DELAY_MS,
  NOSTR_CHAT_THREAD_PAGE_SIZE,
  NOSTR_PROFILE_CACHE_TTL_SECS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import { markChatThreadRead } from '@/db/mutations/nostrChat'
import { getCachedProfile } from '@/db/nostrCache'
import { listChatConversations, listChatThread } from '@/db/queries/nostrChat'
import { useNostrStore } from '@/store/nostr'
import {
  type NostrChatConversation,
  type NostrChatMessage,
  type NostrChatProtocol
} from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  acquireChatPipeline,
  addChatListener,
  addChatStoreListener,
  emitChatStoreChanged,
  getChatPipelineApi,
  releaseChatPipeline,
  sendNip04Chat,
  sendNip17Chat
} from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

type ChatIdentity = {
  npub: string
  nsec?: string
  relays?: string[]
}

function hasSameChatKeys(
  a: ChatIdentity | undefined,
  b: ChatIdentity | undefined
) {
  return a?.npub === b?.npub && a?.nsec === b?.nsec
}

/**
 * While a chat screen is focused, the shared chat pipeline (NIP-04 + NIP-17
 * subscriptions) is held for the identity. Multiple screens acquire/release
 * the same pipeline; switching identity tears down the old subscriptions and
 * opens fresh ones, and the pipeline closes when the last screen leaves.
 */
export function useNostrChatSubscription(identity: ChatIdentity | undefined) {
  // Only an npub/nsec change restarts the pipeline; relay-only updates keep
  // the identity snapshot (and relays) the pipeline was opened with.
  const [pipelineIdentity, setPipelineIdentity] = useState(identity)
  if (!hasSameChatKeys(pipelineIdentity, identity)) {
    setPipelineIdentity(identity)
  }

  useFocusEffect(
    useCallback(() => {
      if (!pipelineIdentity?.nsec) {
        return
      }
      const { nsec } = pipelineIdentity
      const { npub } = pipelineIdentity
      const { relays } = pipelineIdentity
      let cancelled = false
      async function startPipeline() {
        try {
          await acquireChatPipeline({ npub, nsec, relays })
          if (cancelled) {
            releaseChatPipeline(npub)
          }
        } catch {
          // Relay outages are non-fatal; screens still render local history.
        }
      }
      void startPipeline()
      return () => {
        cancelled = true
        releaseChatPipeline(npub)
      }
    }, [pipelineIdentity])
  )
}

async function loadChatProfiles(
  api: NostrAPI,
  hexes: string[],
  setProfile: ReturnType<typeof useNostrStore.getState>['setProfile'],
  isCancelled: () => boolean
) {
  // One retry: the first attempt on cold relay connections often loses to
  // the connect+fetch timeout, which previously left lists stuck forever.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (isCancelled()) {
      return
    }
    try {
      const batch = await api.fetchKind0Batch(hexes)
      if (isCancelled()) {
        return
      }
      for (const [hex, profile] of batch) {
        setProfile(nip19.npubEncode(hex), {
          displayName: profile.displayName,
          picture: profile.picture
        })
      }
      if (batch.size > 0) {
        return
      }
    } catch {
      // fall through to the retry
    }
    if (attempt === 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, NOSTR_CHAT_PROFILE_RETRY_DELAY_MS)
      })
    }
  }
}

/**
 * Batch-fetches kind 0 profiles for DM peers into the shared nostr store.
 * Cache-first (fetchKind0Batch hits the SQLite profile cache), one batch
 * request per missing set — previously DM authors rendered as raw npubs.
 */
export function useNostrChatProfiles(
  identityRelays: string[] | undefined,
  peerNpubs: string[]
) {
  const setProfile = useNostrStore((state) => state.setProfile)
  const profiles = useNostrStore((state) => state.profiles)
  const peersKey = [...peerNpubs].toSorted().join(',')
  const relaysKey = identityRelays?.join(',')
  // Non-reactive on purpose: this effect's own setProfile calls must not
  // cancel and restart the in-flight batch.
  const isProfileMissing = useEffectEvent((npub: string) => {
    const profile = profiles[npub]
    return !(profile?.displayName || profile?.picture)
  })
  const getIdentityRelays = useEffectEvent(() => identityRelays)

  useEffect(() => {
    const missing = peersKey
      .split(',')
      .filter(Boolean)
      .filter((npub) => isProfileMissing(npub))
    if (missing.length === 0) {
      return
    }

    // Cache-first: apply SQLite-cached profiles immediately so known peers
    // render instantly, and only relay-fetch the ones still missing.
    const now = Math.floor(Date.now() / MS_PER_SECOND)
    const stillMissing: string[] = []
    for (const npub of missing) {
      const hex = getPubKeyHexFromNpub(npub)
      const cached = hex ? getCachedProfile(hex) : null
      if (cached && now - cached.cached_at < NOSTR_PROFILE_CACHE_TTL_SECS) {
        setProfile(npub, {
          displayName: cached.displayName,
          picture: cached.picture
        })
      } else {
        stillMissing.push(npub)
      }
    }

    const hexes: string[] = []
    for (const npub of stillMissing) {
      const hex = getPubKeyHexFromNpub(npub)
      if (hex) {
        hexes.push(hex)
      }
    }
    if (hexes.length === 0) {
      return
    }

    const api = new NostrAPI(getNostrContactsRelays(getIdentityRelays()))
    let cancelled = false

    loadChatProfiles(api, hexes, setProfile, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [peersKey, relaysKey, setProfile])
}

export function useNostrChatConversations(
  identityNpub: string | undefined,
  protocol: NostrChatProtocol
) {
  const [conversations, setConversations] = useState<NostrChatConversation[]>(
    []
  )

  const reload = useCallback(() => {
    if (!identityNpub) {
      setConversations([])
      return
    }
    setConversations(listChatConversations(identityNpub, protocol))
  }, [identityNpub, protocol])

  useEffect(() => {
    reload()
    const removeMessage = addChatListener((message) => {
      if (
        message.identityNpub === identityNpub &&
        message.protocol === protocol
      ) {
        reload()
      }
    })
    const removeStore = addChatStoreListener(reload)
    return () => {
      removeMessage()
      removeStore()
    }
  }, [identityNpub, protocol, reload])

  useFocusEffect(
    useCallback(() => {
      reload()
    }, [reload])
  )

  return conversations
}

function sendChatByProtocol(
  api: NostrAPI,
  protocol: NostrChatProtocol,
  sender: Parameters<typeof sendNip17Chat>[1],
  peerNpub: string,
  text: string
) {
  return protocol === 'nip17'
    ? sendNip17Chat(api, sender, peerNpub, text)
    : sendNip04Chat(api, sender, peerNpub, text)
}

export function useNostrChatThread(
  identity: ChatIdentity | undefined,
  protocol: NostrChatProtocol,
  peerNpub: string | undefined,
  peerPubkey: string | undefined
) {
  const [messages, setMessages] = useState<NostrChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const reload = useCallback(() => {
    if (!identity || !peerPubkey) {
      setMessages([])
      return
    }
    setMessages(
      listChatThread(
        identity.npub,
        protocol,
        peerPubkey,
        NOSTR_CHAT_THREAD_PAGE_SIZE
      )
    )
  }, [identity, protocol, peerPubkey])

  // Initial load + mark incoming as read while the thread is open.
  useEffect(() => {
    reload()
    if (identity && peerPubkey) {
      markChatThreadRead(identity.npub, protocol, peerPubkey)
      emitChatStoreChanged()
    }
  }, [reload, identity, protocol, peerPubkey])

  useEffect(() => {
    const remove = addChatListener((message) => {
      if (
        message.identityNpub === identity?.npub &&
        message.protocol === protocol &&
        message.peerPubkey === peerPubkey
      ) {
        if (message.direction === 'in' && identity && peerPubkey) {
          markChatThreadRead(identity.npub, protocol, peerPubkey)
          emitChatStoreChanged()
        }
        reload()
      }
    })
    return remove
  }, [identity, protocol, peerPubkey, reload])

  const send = useCallback(
    async (text: string) => {
      if (!identity?.nsec || !peerNpub) {
        return
      }
      // Clear right away so a slow send can't be re-submitted by accident;
      // the draft is restored if the send fails.
      setInput('')
      setSending(true)
      // Prefer the warm pipeline (live relay connections) over a fresh API.
      const pipelineApi = getChatPipelineApi(identity.npub)
      const api =
        pipelineApi ?? new NostrAPI(getNostrContactsRelays(identity.relays))
      function finishSend() {
        // Refresh in both outcomes so the card flips to sent/failed at once.
        reload()
        setSending(false)
        if (!pipelineApi) {
          api.closeAllSubscriptions()
        }
      }
      try {
        await sendChatByProtocol(
          api,
          protocol,
          { npub: identity.npub, nsec: identity.nsec },
          peerNpub,
          text
        )
      } catch (error) {
        setInput(text)
        finishSend()
        throw error
      }
      finishSend()
    },
    [identity, protocol, peerNpub, reload]
  )

  return { input, messages, send, sending, setInput }
}
