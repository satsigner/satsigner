import { NOSTR_LONG_FORM_NOTE_KIND } from '@/constants/nostrMarkdown'

export function isLongFormNostrKind(kind: number): boolean {
  return (
    kind === NOSTR_LONG_FORM_NOTE_KIND.CONTENT ||
    kind === NOSTR_LONG_FORM_NOTE_KIND.DRAFT
  )
}
