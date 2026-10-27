import { type AuthorDisplayInfo } from '@/hooks/useNostrMessage'
import { Colors } from '@/styles'
import { type NostrAccount, type NostrDM } from '@/types/models/Nostr'
import { formatNpub } from '@/utils/format'
import { safeNpubEncode } from '@/utils/nostr'

type AuthorProfile = { displayName?: string; picture?: string }

type AuthorDisplayInput = {
  dms: NostrDM[]
  members: { color?: string; npub: string }[]
  nostr: Pick<
    NostrAccount,
    | 'deviceDisplayName'
    | 'deviceNpub'
    | 'devicePicture'
    | 'npubAliases'
    | 'npubProfiles'
  >
  /** Profiles by npub (store or freshly fetched). */
  profiles: Record<string, AuthorProfile | undefined>
}

const NPUB_FALLBACK_HEX_CHARS = 8

function uniqueAuthors(dms: NostrDM[]): string[] {
  return [...new Set(dms.map((dm) => dm.author).filter(Boolean))]
}

function buildAuthorInfo(
  author: string,
  input: AuthorDisplayInput
): AuthorDisplayInfo {
  const npub = safeNpubEncode(author, '')
  const { nostr } = input
  const member = input.members.find((m) => m.npub === npub)
  const profile = npub ? input.profiles[npub] : undefined
  const accountProfile = npub ? nostr.npubProfiles?.[npub] : undefined
  const isCurrentDevice = !!npub && npub === nostr.deviceNpub
  const alias = npub ? (nostr.npubAliases?.[npub] ?? '').trim() : ''
  return {
    alias: alias || undefined,
    color: member?.color || Colors.gray[500],
    displayName:
      profile?.displayName ??
      accountProfile?.displayName ??
      (isCurrentDevice ? nostr.deviceDisplayName : undefined),
    npubShort: npub
      ? formatNpub(npub)
      : author.slice(0, NPUB_FALLBACK_HEX_CHARS),
    picture:
      profile?.picture ??
      accountProfile?.picture ??
      (isCurrentDevice ? nostr.devicePicture : undefined)
  }
}

/** Display info (name, alias, color, picture) for every DM author. */
function buildAuthorDisplayMap(
  input: AuthorDisplayInput
): Map<string, AuthorDisplayInfo> {
  return new Map(
    uniqueAuthors(input.dms).map((author) => [
      author,
      buildAuthorInfo(author, input)
    ])
  )
}

/** Hex pubkeys of authors that have neither a profile nor account profile. */
function getAuthorsMissingProfiles(input: AuthorDisplayInput): string[] {
  return uniqueAuthors(input.dms).filter((author) => {
    const npub = safeNpubEncode(author, '')
    if (!npub) {
      return false
    }
    const profile = input.profiles[npub] ?? input.nostr.npubProfiles?.[npub]
    return !profile?.displayName && !profile?.picture
  })
}

export { buildAuthorDisplayMap, getAuthorsMissingProfiles }
export type { AuthorDisplayInput, AuthorProfile }
