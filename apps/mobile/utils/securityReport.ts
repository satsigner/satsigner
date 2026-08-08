import { NostrAPI } from '@/api/nostr'
import { NOSTR_SECURITY_REPORT_NPUB } from '@/constants/nostr'
import { type NostrChatMessage } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { ingestChatMessage } from '@/utils/nostrChat'
import { randomKey } from '@/utils/crypto'
import { getPublicKey, nip19 } from 'nostr-tools'

type SecurityReportIdentity = {
  npub: string
  nsec: string
}

/**
 * Sends a security report to the project npub as a NIP-17 gift wrap.
 *
 * Anonymous mode generates a throwaway keypair per report: nothing about the
 * sender is persisted and there is no reply channel. With an identity, the
 * report is a normal chat message — it lands in the identity's conversation
 * with the project npub, so maintainers can reply.
 */
export async function sendSecurityReport({
  message,
  relays,
  identity
}: {
  message: string
  relays: string[]
  identity?: SecurityReportIdentity
}): Promise<void> {
  const text = message.trim()
  if (!text) {
    throw new Error('empty report')
  }

  let npub: string
  let nsec: string
  const anonymous = !identity
  if (identity) {
    npub = identity.npub
    nsec = identity.nsec
  } else {
    const secretKey = new Uint8Array(Buffer.from(await randomKey(32), 'hex'))
    npub = nip19.npubEncode(getPublicKey(secretKey))
    nsec = nip19.nsecEncode(secretKey)
  }

  const api = new NostrAPI(relays)
  const wrap = api.createKind1059(nsec, NOSTR_SECURITY_REPORT_NPUB, text)
  await api.publishEvent(wrap)

  // Anonymous reports leave no local trace; identified reports continue in
  // the identity's chat thread with the project npub.
  if (!anonymous && identity) {
    const peerPubkey = getPubKeyHexFromNpub(NOSTR_SECURITY_REPORT_NPUB)
    if (peerPubkey) {
      const stored: NostrChatMessage = {
        content: text,
        created_at: Math.floor(Date.now() / 1000),
        direction: 'out',
        id: wrap.id ?? `report-${Date.now()}`,
        identityNpub: identity.npub,
        peerPubkey,
        protocol: 'nip17',
        read: true,
        status: 'sent'
      }
      ingestChatMessage(stored)
    }
  }
}
