import { NostrAPI } from '@/api/nostr'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import type {
  NostrDecodedContent,
  NostrFetchedNoteData,
  NostrKind0Profile
} from '@/types/models/Nostr'
import { getDecodedContentTags } from '@/utils/nostrDecodedContent'

type NostrNoteEvent = {
  content: string
  created_at: number
  kind: number
  pubkey: string
  tags: string[][]
}

const EVENT_JSON_INDENT = 2

/** Privacy mode hides tag values (media urls, mentions) but not tag names. */
function getNoteTagsForDisplay(
  tags: string[][],
  privacyMode: boolean
): string[][] {
  if (!privacyMode) {
    return tags
  }
  return tags.map(([name, ...values]) =>
    values.length > 0 ? [name, NOSTR_PRIVACY_MASK] : [name]
  )
}

function buildNoteEventJson(
  note: NostrNoteEvent,
  id: string,
  privacyMode: boolean
): string {
  return JSON.stringify(
    {
      content: privacyMode ? NOSTR_PRIVACY_MASK : note.content,
      created_at: note.created_at,
      id,
      kind: note.kind,
      pubkey: note.pubkey,
      tags: getNoteTagsForDisplay(note.tags, privacyMode)
    },
    null,
    EVENT_JSON_INDENT
  )
}

/** A note pasted as raw JSON needs no fetch: it is shown as given. */
function getJsonNoteData(
  decoded: NostrDecodedContent | null
): NostrFetchedNoteData | null {
  if (decoded?.kind !== 'json_note' || !decoded.metadata) {
    return null
  }
  const { content, kind } = decoded.metadata
  return {
    content: typeof content === 'string' ? content : '',
    created_at: 0,
    kind: typeof kind === 'number' ? kind : 1,
    pubkey: '',
    tags: getDecodedContentTags(decoded)
  }
}

function withAuthorProfile(
  event: NostrNoteEvent | null | undefined,
  profile: NostrKind0Profile | null | undefined
): NostrFetchedNoteData | null {
  if (!event) {
    return null
  }
  return {
    authorLud16: profile?.lud16,
    authorName: profile?.displayName,
    authorNip05: profile?.nip05,
    authorPicture: profile?.picture,
    content: event.content,
    created_at: event.created_at,
    kind: event.kind,
    pubkey: event.pubkey,
    tags: event.tags
  }
}

/**
 * Finds an event on the identity's relays (cache first), then on each
 * fallback relay set in order. Unreachable relay sets count as "not there".
 */
async function lookupNostrEvent(
  eventId: string,
  relays: string[],
  ownPubkeys: string[],
  fallbackRelaySets: string[][]
): Promise<NostrNoteEvent | null> {
  const own = await new NostrAPI(relays, ownPubkeys).fetchEvent(eventId).then(
    (event) => event,
    () => null
  )
  if (own) {
    return own
  }
  for (const fallbackRelays of fallbackRelaySets) {
    const found = await NostrAPI.fetchEventFromRelays(
      eventId,
      fallbackRelays,
      ownPubkeys
    ).then(
      (event) => event,
      () => null
    )
    if (found) {
      return found
    }
  }
  return null
}

export {
  buildNoteEventJson,
  getJsonNoteData,
  getNoteTagsForDisplay,
  lookupNostrEvent,
  withAuthorProfile
}
export type { NostrNoteEvent }
