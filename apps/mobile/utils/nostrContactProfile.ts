import { nip19 } from 'nostr-tools'

import {
  NOSTR_CONTACT_QR_SLIDE_KEYS,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import { t } from '@/locales'
import { type NostrContactQrSlide } from '@/types/models/Nostr'

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
