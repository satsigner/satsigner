import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { markChatThreadRead } from '@/db/mutations/nostrChat'
import {
  listChatConversations,
  listChatThread
} from '@/db/queries/nostrChat'
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
      const nsec = identity.nsec
      const { npub } = identity
      const relays = identity.relays
      let held = false
      acquireChatPipeline({ npub, nsec, relays })
        .then(() => {
          held = true
        })
        .catch(() => {
          // Relay outages are non-fatal; screens still render local history.
        })
      return () => {
        if (held) {
          releaseChatPipeline(npub)
        }
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
  const peersKey = [...peerNpubs].sort().join(',')

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

    const hexes = missing
      .map((npub) => getPubKeyHexFromNpub(npub))
      .filter((hex): hex is string => Boolean(hex))
    if (hexes.length === 0) {
      return
    }

    const api = new NostrAPI(getNostrContactsRelays(identityRelays))
    let cancelled = false
    api
      .fetchKind0Batch(hexes)
      .then((batch) => {
        if (cancelled) {
          return
        }
        for (const [hex, profile] of batch) {
          setProfile(nip19.npubEncode(hex), {
            displayName: profile.displayName,
            picture: profile.picture
          })
        }
      })
      .catch(() => {
        // Relay outages are non-fatal; truncated npub remains as fallback.
      })
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
      if (message.identityNpub === identityNpub && message.protocol === protocol) {
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
    setMessages(
      listChatThread(identity.npub, protocol, peerPubkey, 200)
    )
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
      setSending(true)
      const relays = getNostrContactsRelays(identity.relays)
      const api = new NostrAPI(relays)
      try {
        if (protocol === 'nip17') {
          await sendNip17Chat(
            api,
            { npub: identity.npub, nsec: identity.nsec },
            peerNpub,
            text
          )
        } else {
          await sendNip04Chat(
            api,
            { npub: identity.npub, nsec: identity.nsec },
            peerNpub,
            text
          )
        }
        setInput('')
        reload()
      } finally {
        setSending(false)
      }
    },
    [identity, protocol, peerNpub, reload]
  )

  return { input, messages, send, sending, setInput }
}
