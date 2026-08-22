import { useFocusEffect } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useState } from 'react'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_PROFILE_CACHE_TTL_SECS } from '@/constants/nostr'
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

/**
 * While a chat screen is focused, the shared chat pipeline (NIP-04 + NIP-17
 * subscriptions) is held for the identity. Multiple screens acquire/release
 * the same pipeline; switching identity tears down the old subscriptions and
 * opens fresh ones, and the pipeline closes when the last screen leaves.
 */
export function useNostrChatSubscription(identity: ChatIdentity | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (!identity?.nsec) {
        return
      }
      const { nsec } = identity
      const { npub } = identity
      const { relays } = identity
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
    }, [identity?.npub, identity?.nsec]) // eslint-disable-line react-hooks/exhaustive-deps
  )
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

  useEffect(() => {
    const missing = peersKey
      .split(',')
      .filter(Boolean)
      .filter((npub) => {
        const profile = profiles[npub]
        return !(profile?.displayName || profile?.picture)
      })
    if (missing.length === 0) {
      return
    }

    // Cache-first: apply SQLite-cached profiles immediately so known peers
    // render instantly, and only relay-fetch the ones still missing.
    const now = Math.floor(Date.now() / 1000)
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

    const api = new NostrAPI(getNostrContactsRelays(identityRelays))
    let cancelled = false

    async function load() {
      // One retry: the first attempt on cold relay connections often loses to
      // the connect+fetch timeout, which previously left lists stuck forever.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (cancelled) {
          return
        }
        try {
          const batch = await api.fetchKind0Batch(hexes)
          if (cancelled) {
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
            setTimeout(resolve, 5_000)
          })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peersKey, identityRelays?.join(','), setProfile])
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
    const remove = addChatListener((message) => {
      if (
        message.identityNpub === identityNpub &&
        message.protocol === protocol
      ) {
        reload()
      }
    })
    return remove
  }, [identityNpub, protocol, reload])

  return conversations
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
    setMessages(listChatThread(identity.npub, protocol, peerPubkey, 200))
  }, [identity, protocol, peerPubkey])

  // Initial load + mark incoming as read while the thread is open.
  useEffect(() => {
    reload()
    if (identity && peerPubkey) {
      markChatThreadRead(identity.npub, protocol, peerPubkey)
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
      try {
        await (protocol === 'nip17'
          ? sendNip17Chat(
              api,
              { npub: identity.npub, nsec: identity.nsec },
              peerNpub,
              text
            )
          : sendNip04Chat(
              api,
              { npub: identity.npub, nsec: identity.nsec },
              peerNpub,
              text
            ))
      } catch (error) {
        setInput(text)
        throw error
      } finally {
        // Refresh in both outcomes so the card flips to sent/failed at once.
        reload()
        setSending(false)
        if (!pipelineApi) {
          api.closeAllSubscriptions()
        }
      }
    },
    [identity, protocol, peerNpub, reload]
  )

  return { input, messages, send, sending, setInput }
}
