import type { NostrChatMessage } from '@/types/models/Nostr'
import { findChatPaymentRequests } from '@/utils/chatPaymentRequests'
import { toChatThreadItem } from '@/utils/nostrChat'
import { getDmText } from '@/utils/nostrDms'

// BOLT 11 spec vector: 250 000 sats, "1 cup coffee".
const INVOICE =
  'lnbc2500u1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpu9qrsgquk0rl77nj30yxdy8j9vdx85fkpmdla2087ne0xh8nhedh8w27kyke0lp53ut353s06fv3qfegext0eh0ymjpf39tuven09sam30g4vgpfna3rh'
const OWN_HEX = '1'.repeat(64)
const PEER_HEX = '2'.repeat(64)

function storedMessage(content: string): NostrChatMessage {
  return {
    content,
    created_at: 1_700_000_000,
    direction: 'in',
    id: 'a'.repeat(64),
    identityNpub: 'npub1own',
    peerPubkey: PEER_HEX,
    protocol: 'nip17',
    read: true,
    status: 'sent'
  }
}

const AUTHORS = {
  ownHex: OWN_HEX,
  ownNpub: 'npub1own',
  peerNpub: 'npub1peer'
}

describe('getDmText', () => {
  it('reads the text a stored chat message carries', () => {
    const { dm } = toChatThreadItem(storedMessage('hello'), AUTHORS)
    expect(getDmText(dm)).toBe('hello')
  })

  it('reads legacy DMs whose content is a plain string', () => {
    expect(getDmText({ content: 'legacy text' })).toBe('legacy text')
  })

  it('returns null when the DM carries no text', () => {
    expect(getDmText({ content: { created_at: 0 } })).toBeNull()
    expect(getDmText({ content: null })).toBeNull()
  })

  it('hands the invoice in a stored message to the payment card parser', () => {
    const { dm } = toChatThreadItem(
      storedMessage(`Top up here:\n${INVOICE}`),
      AUTHORS
    )
    const [request] = findChatPaymentRequests(getDmText(dm) ?? '')
    expect(request?.kind).toBe('lightning')
    expect(request?.amountSats).toBe(250_000)
  })
})
