import { NostrAPI } from '@/api/nostr'
import {
  NOSTR_ENGAGEMENT_BATCH_DELAY_MS,
  NOSTR_ENGAGEMENT_BATCH_SIZE
} from '@/constants/nostr'
import { type NostrEngagementEvent } from '@/types/models/Nostr'
import { chunk, groupBy } from '@/utils/array'
import { getNostrContactsRelaysKey } from '@/utils/nostrContacts'

type Waiter = {
  reject: (error: unknown) => void
  resolve: (events: NostrEngagementEvent[]) => void
}

type PendingBatch = {
  ownPubkey: string
  relays: string[]
  waitersByNoteId: Map<string, Waiter[]>
}

const pendingBatches = new Map<string, PendingBatch>()

function settleChunk(
  batch: PendingBatch,
  noteIds: string[],
  outcome: { events: NostrEngagementEvent[] } | { error: unknown }
) {
  const eventsByNoteId =
    'events' in outcome
      ? groupBy(outcome.events, (event) => event.targetId)
      : null
  for (const noteId of noteIds) {
    for (const waiter of batch.waitersByNoteId.get(noteId) ?? []) {
      if ('error' in outcome) {
        waiter.reject(outcome.error)
        continue
      }
      waiter.resolve(eventsByNoteId?.get(noteId) ?? [])
    }
  }
}

async function flushChunk(
  api: NostrAPI,
  batch: PendingBatch,
  noteIds: string[]
) {
  try {
    const events = await api.fetchEngagement(noteIds, batch.ownPubkey)
    settleChunk(batch, noteIds, { events })
  } catch (error) {
    settleChunk(batch, noteIds, { error })
  }
}

async function flushBatch(batch: PendingBatch) {
  const api = new NostrAPI(batch.relays)
  try {
    await Promise.all(
      chunk([...batch.waitersByNoteId.keys()], NOSTR_ENGAGEMENT_BATCH_SIZE).map(
        (noteIds) => flushChunk(api, batch, noteIds)
      )
    )
  } finally {
    api.disconnect()
  }
}

function openBatch(key: string, relays: string[], ownPubkey: string) {
  const batch: PendingBatch = {
    ownPubkey,
    relays,
    waitersByNoteId: new Map()
  }
  pendingBatches.set(key, batch)
  setTimeout(() => {
    pendingBatches.delete(key)
    void flushBatch(batch)
  }, NOSTR_ENGAGEMENT_BATCH_DELAY_MS)
  return batch
}

/**
 * Likes and reposts of one note. Calls made within a short window for the
 * same relays share one REQ per chunk of notes, so a feed screen costs one
 * round trip instead of one per card.
 */
function fetchNoteEngagementCoalesced(
  noteId: string,
  relays: string[],
  ownPubkey: string
): Promise<NostrEngagementEvent[]> {
  const key = `${getNostrContactsRelaysKey(relays)}|${ownPubkey}`
  const batch = pendingBatches.get(key) ?? openBatch(key, relays, ownPubkey)
  return new Promise((resolve, reject) => {
    const waiters = batch.waitersByNoteId.get(noteId) ?? []
    waiters.push({ reject, resolve })
    batch.waitersByNoteId.set(noteId, waiters)
  })
}

export { fetchNoteEngagementCoalesced }
