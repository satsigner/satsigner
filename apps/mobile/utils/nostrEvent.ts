import { type NostrEvent as NDKNostrEvent } from '@nostr-dev-kit/ndk'
import { type EventTemplate, type NostrEvent } from 'nostr-tools'
import { z } from 'zod'

import { type NostrUnwrappedKind1059Event } from '@/types/models/Nostr'

const NostrTagsSchema = z.array(z.array(z.string()))

const NostrEventTemplateSchema = z.object({
  content: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: NostrTagsSchema
})

const NostrEventSchema = NostrEventTemplateSchema.extend({
  id: z.string(),
  pubkey: z.string(),
  sig: z.string()
})

const NostrRumorSchema = z.looseObject({
  content: z.string(),
  created_at: z.number().optional(),
  id: z.string(),
  pubkey: z.string()
})

/** Narrows untrusted data (parsed JSON) to nostr tags: lists of strings. */
export function isNostrTags(value: unknown): value is string[][] {
  return NostrTagsSchema.safeParse(value).success
}

/**
 * Parses untrusted data (e.g. a NIP-46 `sign_event` payload) into an event
 * template ready for signing. Unknown fields are dropped; null when a field is
 * missing or has the wrong type.
 */
export function parseNostrEventTemplate(value: unknown): EventTemplate | null {
  const result = NostrEventTemplateSchema.safeParse(value)
  return result.success ? result.data : null
}

/**
 * Parses untrusted data (relay frames, decrypted JSON) into a signed event.
 * Only the shape is checked, callers still verify the id and signature when
 * authenticity matters. Null when malformed.
 */
export function parseNostrEvent(value: unknown): NostrEvent | null {
  const result = NostrEventSchema.safeParse(value)
  return result.success ? result.data : null
}

/**
 * Parses a decrypted NIP-59 rumor. Fields beyond the checked ones (kind,
 * tags, ...) are kept for consumers that read them. Null when malformed.
 */
export function parseNostrRumor(
  value: unknown
): NostrUnwrappedKind1059Event | null {
  const result = NostrRumorSchema.safeParse(value)
  return result.success ? result.data : null
}

/**
 * Narrows an NDK-serialized event (`NDKEvent.toNostrEvent()`, where id, sig
 * and kind are optional) to a signed event accepted by nostr-tools.
 */
export function isSignedNdkEvent(
  event: NDKNostrEvent
): event is NDKNostrEvent & Pick<NostrEvent, 'id' | 'kind' | 'sig'> {
  return Boolean(event.id) && Boolean(event.sig) && event.kind !== undefined
}
