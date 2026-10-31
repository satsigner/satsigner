import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useIsFocused } from 'expo-router/react-navigation'
import { useCallback, useState, useSyncExternalStore } from 'react'

import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_CHAT_PROFILE_RETRY_DELAY_MS,
  NOSTR_CHAT_THREAD_PAGE_SIZE,
  NOSTR_PROFILE_CACHE_TTL_SECS
} from '@/constants/nostr'
import { MS_PER_SECOND } from '@/constants/time'
import {
  type NostrChatConversationItem,
  type NostrChatProtocol,
  type NostrChatThreadItem
} from '@/types/models/Nostr'
import {
  acquireChatPipeline,
  getChatPipelineApi,
  getChatPipelineStatus,
  invalidateChatQueries,
  listChatConversationItems,
  loadChatPeerProfiles,
  loadChatThreadItems,
  loadOlderChatHistory,
  nostrChatQueryKeys,
  restartChatPipeline,
  sendNip04Chat,
  sendNip17Chat,
  subscribeChatPipelineStatus
} from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { isNonEmptyString } from '@/utils/string'

type ChatIdentity = {
  npub: string
  nsec?: string
  relays?: string[]
}

const NO_CONVERSATIONS: NostrChatConversationItem[] = []
const NO_THREAD_ITEMS: NostrChatThreadItem[] = []

/**
 * While a chat screen is focused, the shared chat pipeline (NIP-04 + NIP-17
 * subscriptions) is held for the identity. Returns the pipeline status so
 * screens can show relay failures, and a retry that reopens the pipeline.
 */
export function useNostrChatSubscription(identity: ChatIdentity | undefined) {
  const npub = identity?.npub
  const nsec = identity?.nsec
  const relays = identity?.relays

  useFocusEffect(
    useCallback(() => {
      if (!isNonEmptyString(npub) || !isNonEmptyString(nsec)) {
        return
      }
      return acquireChatPipeline({ npub, nsec, relays }).release
    }, [npub, nsec, relays])
  )

  const status = useSyncExternalStore(subscribeChatPipelineStatus, () =>
    getChatPipelineStatus(npub ?? '')
  )
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    if (!isNonEmptyString(npub)) {
      return
    }
    setRetrying(true)
    try {
      await restartChatPipeline(npub)
    } catch {
      // Relay outages are non-fatal; retry state still clears below.
    }
    setRetrying(false)
  }

  return { retry, retrying, status }
}

/**
 * Loads kind 0 profiles for DM peers into the shared nostr store so
 * conversations render names instead of raw npubs.
 */
export function useNostrChatProfiles(
  identityRelays: string[] | undefined,
  peerNpubs: string[]
) {
  const peersKey = peerNpubs.toSorted().join(',')
  useQuery({
    enabled: peerNpubs.length > 0,
    queryFn: async () => {
      const loaded = await loadChatPeerProfiles(identityRelays, peerNpubs)
      return loaded
    },
    queryKey: nostrChatQueryKeys.profiles(
      peersKey,
      identityRelays?.join(',') ?? ''
    ),
    retry: 1,
    retryDelay: NOSTR_CHAT_PROFILE_RETRY_DELAY_MS,
    staleTime: NOSTR_PROFILE_CACHE_TTL_SECS * MS_PER_SECOND
  })
}

export function useNostrChatConversations(
  identityNpub: string | undefined,
  protocol: NostrChatProtocol
) {
  const { data } = useQuery({
    enabled: Boolean(identityNpub),
    queryFn: () => listChatConversationItems(identityNpub ?? '', protocol),
    queryKey: nostrChatQueryKeys.conversations(identityNpub ?? '', protocol)
  })
  return data ?? NO_CONVERSATIONS
}

async function sendChatMessage(
  api: NostrAPI,
  identity: { npub: string; nsec: string },
  protocol: NostrChatProtocol,
  peerNpub: string,
  text: string
): Promise<void> {
  const sendForProtocol = protocol === 'nip17' ? sendNip17Chat : sendNip04Chat
  await sendForProtocol(api, identity, peerNpub, text)
}

export function useNostrChatThread(
  identity: ChatIdentity | undefined,
  protocol: NostrChatProtocol,
  peerNpub: string | undefined,
  peerPubkey: string | undefined
) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [limit, setLimit] = useState(NOSTR_CHAT_THREAD_PAGE_SIZE)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [historyExhausted, setHistoryExhausted] = useState(false)
  const identityNpub = identity?.npub ?? ''
  const focused = useIsFocused()

  const { data } = useQuery({
    enabled: focused && Boolean(identity && peerPubkey),
    placeholderData: keepPreviousData,
    queryFn: () =>
      loadChatThreadItems(identityNpub, protocol, peerPubkey ?? '', limit),
    queryKey: nostrChatQueryKeys.thread(
      identityNpub,
      protocol,
      peerPubkey ?? '',
      limit
    )
  })
  const items = data ?? NO_THREAD_ITEMS

  /** Older stored messages first; relays are paged only past local history. */
  async function loadOlder() {
    if (!identity || loadingOlder || historyExhausted) {
      return
    }
    if (items.length >= limit) {
      setLimit(limit + NOSTR_CHAT_THREAD_PAGE_SIZE)
      return
    }
    setLoadingOlder(true)
    try {
      const { exhausted } = await loadOlderChatHistory(identity.npub, protocol)
      setHistoryExhausted(exhausted)
    } catch (error) {
      setLoadingOlder(false)
      throw error
    }
    setLoadingOlder(false)
  }

  async function send(text: string) {
    if (!isNonEmptyString(identity?.nsec) || !isNonEmptyString(peerNpub)) {
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
    try {
      await sendChatMessage(
        api,
        { npub: identity.npub, nsec: identity.nsec },
        protocol,
        peerNpub,
        text
      )
    } catch (error) {
      setInput(text)
      invalidateChatQueries(identity.npub)
      setSending(false)
      if (!pipelineApi) {
        api.closeAllSubscriptions()
      }
      throw error
    }
    invalidateChatQueries(identity.npub)
    setSending(false)
    if (!pipelineApi) {
      api.closeAllSubscriptions()
    }
  }

  return { input, items, loadOlder, loadingOlder, send, sending, setInput }
}
