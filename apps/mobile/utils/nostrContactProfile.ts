import { nip19 } from 'nostr-tools'

import {
  NOSTR_CONTACT_QR_SLIDE_KEYS,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { t } from '@/locales'
import {
  type NostrContactQrSlide,
  type NostrIdentity,
  type NostrKind0Profile
} from '@/types/models/Nostr'

type BuildContactQrSlidesOptions = {
  contactNprofile: string | null
  lud16?: string
  targetNpub?: string
}

export function encodeContactNprofile(
  pubkeyHex: string,
  relays: string[]
): string | null {
  try {
    return nip19.nprofileEncode({
      pubkey: pubkeyHex,
      relays: relays.length > 0 ? relays : []
    })
  } catch {
    return null
  }
}

export function buildContactQrSlides(
  options: BuildContactQrSlidesOptions
): NostrContactQrSlide[] {
  const slides: NostrContactQrSlide[] = []

  if (options.targetNpub) {
    slides.push({
      key: NOSTR_CONTACT_QR_SLIDE_KEYS.NPUB,
      kind: 'qr',
      label: t('nostrIdentity.contact.qrNpub'),
      value: options.targetNpub
    })
  }

  if (options.contactNprofile) {
    slides.push({
      key: NOSTR_CONTACT_QR_SLIDE_KEYS.NPROFILE,
      kind: 'qr',
      label: t('nostrIdentity.contact.qrNprofile'),
      value: options.contactNprofile
    })
  }

  if (options.lud16) {
    slides.push({
      key: NOSTR_CONTACT_QR_SLIDE_KEYS.LUD16,
      kind: 'qr',
      label: t('nostrIdentity.contact.qrLightningAddress'),
      value: options.lud16
    })
  }

  slides.push({
    key: NOSTR_CONTACT_QR_SLIDE_KEYS.SILENT_PAYMENT,
    kind: 'placeholder',
    label: t('nostrIdentity.contact.qrSilentPayment')
  })

  return slides
}

export function getContactShareProfileName(
  displayName: string | undefined,
  privacyMode: boolean
): string {
  if (privacyMode) {
    return NOSTR_PRIVACY_MASK
  }

  return displayName?.trim() || t('nostrIdentity.contact.unnamed')
}

/** Watch-only identity for a contact, filled with their kind 0 profile when known. */
export function buildContactIdentity(
  npub: string,
  profile: NostrKind0Profile | null | undefined,
  createdAt: number
): NostrIdentity {
  return {
    banner: profile?.banner,
    createdAt,
    displayName: profile?.displayName,
    isWatchOnly: true,
    lud16: profile?.lud16,
    nip05: profile?.nip05,
    npub,
    picture: profile?.picture
  }
}
