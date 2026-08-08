import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'

import { NostrAPI } from '@/api/nostr'
import { markChatThreadRead } from '@/db/mutations/nostrChat'
import {
  listChatConversations,
  listChatThread
} from '@/db/queries/nostrChat'
import {
  type NostrChatConversation,
  type NostrChatMessage,
  type NostrChatProtocol
} from '@/types/models/Nostr'
import {
  addChatListener,
  sendNip04Chat,
  sendNip17Chat,
  subscribeToIdentityChat
} from '@/utils/nostrChat'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

type ChatIdentity = {
  npub: string
  nsec?: string
  relays?: string[]
}

/**
 * While a chat screen is focused, keep both DM subscriptions (NIP-04 +
 * NIP-17) open for the identity; incoming messages land in SQLite and are
 * pushed to listeners. Blurring tears the subscriptions down.
 */
export function useNostrChatSubscription(identity: ChatIdentity | undefined) {
  useFocusEffect(
    useCallback(() => {
      if (!identity?.nsec) {
        return
      }
      const relays = getNostrContactsRelays(identity.relays)
      const api = new NostrAPI(relays)
      subscribeToIdentityChat(api, {
        npub: identity.npub,
        nsec: identity.nsec
      }).catch(() => {
        // Relay outages are non-fatal; the screens still render local history.
      })
      return () => {
        api.closeAllSubscriptions()
      }
    }, [identity?.npub, identity?.nsec]) // eslint-disable-line react-hooks/exhaustive-deps
  )
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
