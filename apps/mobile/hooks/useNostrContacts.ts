import { useEffect, useState } from 'react'

import { NostrAPI } from '@/api/nostr'
import { type NostrKind0Profile } from '@/types/models/Nostr'

export type ContactItem = {
  pubkey: string
  profile: NostrKind0Profile | null
}

type UseNostrContactsResult = {
  connectedRelayCount: number
  contacts: ContactItem[]
  isError: boolean
  isLoading: boolean
  kind3Found: boolean
  relaysQueried: string[]
}

export function useNostrContacts(
  npub: string | undefined,
  contactsRelays: string[],
  relayConnected: boolean
): UseNostrContactsResult {
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [connectedRelayCount, setConnectedRelayCount] = useState(0)
  const [isError, setIsError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [kind3Found, setKind3Found] = useState(false)
  const [relaysQueried, setRelaysQueried] = useState<string[]>([])

  useEffect(() => {
    if (!npub || !relayConnected) {
      return
    }

    let cancelled = false
    const api = new NostrAPI(contactsRelays)

    async function run() {
      setIsLoading(true)
      setIsError(false)
      setContacts([])
      setKind3Found(false)
      setRelaysQueried([])
      setConnectedRelayCount(0)

      try {
        const result = await api.fetchKind3FollowingPubkeys(npub!)
        if (cancelled) {
          return
        }

        setKind3Found(result.kind3Found)
        setRelaysQueried(result.relaysQueried)
        setConnectedRelayCount(result.connectedRelayCount)

        if (result.pubkeys.length === 0) {
          setIsLoading(false)
          return
        }

        // Show list immediately with pubkey abbreviations; profiles fill in progressively
        setContacts(result.pubkeys.map((pk) => ({ profile: null, pubkey: pk })))
        setIsLoading(false)

        await api.streamKind0Profiles(result.pubkeys, (batch) => {
          if (cancelled) {
            return
          }
          setContacts((prev) =>
            prev.map((c) => {
              const profile = batch.get(c.pubkey)
              return profile ? { ...c, profile } : c
            })
          )
        })
      } catch {
        if (cancelled) {
          return
        }
        setIsError(true)
        setIsLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
      api.disconnect()
    }
  }, [npub, relayConnected, contactsRelays.join(',')])

  return {
    connectedRelayCount,
    contacts,
    isError,
    isLoading,
    kind3Found,
    relaysQueried
  }
}
