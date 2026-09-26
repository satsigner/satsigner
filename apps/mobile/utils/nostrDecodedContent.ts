import { type NostrDecodedContent } from '@/types/models/Nostr'
import { isStringArray } from '@/utils/array'

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/**
 * Tags carried in decoded content metadata (e.g. a pasted JSON note).
 * Metadata is untrusted, so tags that are not string arrays are dropped.
 */
export function getDecodedContentTags(
  content: NostrDecodedContent
): string[][] {
  const tags = content.metadata?.tags
  return Array.isArray(tags) ? tags.filter(isStringArray) : []
}

/**
 * Relay hints carried in decoded content metadata (nevent, nprofile).
 * Returns undefined when there is no usable relay hint.
 */
export function getDecodedContentRelays(
  content: NostrDecodedContent
): string[] | undefined {
  const relays = content.metadata?.relays
  if (!Array.isArray(relays)) {
    return undefined
  }
  const hints = relays.filter(isString)
  return hints.length > 0 ? hints : undefined
}
