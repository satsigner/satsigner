import { nip19 } from 'nostr-tools'

import { NostrAPI } from '@/api/nostr'
import { NOSTR_SECURITY_REPORT_NPUB } from '@/constants/nostr'
import { type NostrChatMessage } from '@/types/models/Nostr'
import { generateMnemonic } from '@/utils/bip39'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { ingestChatMessage, resolveRecipientRelays } from '@/utils/nostrChat'
import { deriveNostrKeysFromMnemonic } from '@/utils/nostrIdentity'

export type ThrowawayIdentity = {
  mnemonic: string
  npub: string
  nsec: string
}

/**
 * A one-time NIP-06 identity for anonymous reports. Mnemonic-derived so the
 * user can save the seed words / nsec and later re-import to read our reply.
 */
export function createThrowawayIdentity(): ThrowawayIdentity {
  const mnemonic = generateMnemonic(12)
  const { npub, nsec } = deriveNostrKeysFromMnemonic(mnemonic)
  return { mnemonic, npub, nsec }
}

type SecurityReportIdentity = {
  npub: string
  nsec: string
}

/**
 * Sends a report to the project npub as a NIP-17 gift wrap.
 *
 * Anonymous reports (persistCopy: false, typically a throwaway identity)
 * leave no local trace. Identified reports persist the outgoing message into
 * the identity's chat thread with the project npub, so replies are visible.
 */
export async function sendSecurityReport({
  message,
  relays,
  senderIdentity,
  persistCopy
}: {
  message: string
  relays: string[]
  senderIdentity: SecurityReportIdentity
  persistCopy: boolean
}): Promise<void> {
  const text = message.trim()
  if (!text) {
    throw new Error('empty report')
  }

  const api = new NostrAPI(relays)
  const wrap = api.createKind1059(
    senderIdentity.nsec,
    NOSTR_SECURITY_REPORT_NPUB,
    text
  )

  // Route to the project npub's announced inbox relays when published —
  // otherwise the report can land on relays the maintainers never read.
  const targetRelays = await resolveRecipientRelays(
    NOSTR_SECURITY_REPORT_NPUB,
    relays
  )
  const publishApi =
    targetRelays === relays ? api : new NostrAPI(targetRelays)
  await publishApi.publishEvent(wrap)

  if (persistCopy) {
    const peerPubkey = getPubKeyHexFromNpub(NOSTR_SECURITY_REPORT_NPUB)
    if (peerPubkey) {
      const stored: NostrChatMessage = {
        content: text,
        created_at: Math.floor(Date.now() / 1000),
        direction: 'out',
        id: wrap.id ?? `report-${Date.now()}`,
        identityNpub: senderIdentity.npub,
        peerPubkey,
        protocol: 'nip17',
        read: true,
        status: 'sent'
      }
      ingestChatMessage(stored)
    }
  }
}

/** npub of the report destination, for display/copy in the UI. */
export function getSecurityReportNpub(): string {
  return NOSTR_SECURITY_REPORT_NPUB
}

export { nip19 }
