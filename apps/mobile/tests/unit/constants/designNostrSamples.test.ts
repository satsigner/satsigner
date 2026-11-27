import {
  DESIGN_CHAT_PAYMENT_CARDS,
  DESIGN_NOSTR_ARCHIVED_SESSIONS,
  DESIGN_NOSTR_FOLLOWING_CONVERSATIONS
} from '@/constants/designNostrSamples'
import { MS_PER_SECOND } from '@/constants/time'
import {
  getChatInvoiceTiming,
  isChatPaymentRequestExpired
} from '@/utils/chatPaymentRequests'
import {
  getConversationKey,
  labelConversationSessions
} from '@/utils/nostrChatSessions'
import { isChatSessionId } from '@/utils/nostrChatTags'

function cardFor(labelKey: string) {
  const card = DESIGN_CHAT_PAYMENT_CARDS.find(
    (sample) => sample.labelKey === labelKey
  )
  if (!card) {
    throw new Error(`missing design card ${labelKey}`)
  }
  return card
}

describe('design chat payment cards', () => {
  const nowMs = Date.now()

  it('has one card per state, each with its own label', () => {
    const keys = DESIGN_CHAT_PAYMENT_CARDS.map((card) => card.labelKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('covers both kinds of payment request', () => {
    const kinds = new Set(
      DESIGN_CHAT_PAYMENT_CARDS.map((card) => card.request.kind)
    )
    expect(kinds).toStrictEqual(new Set(['lightning', 'bitcoin']))
  })

  it('keeps the payable invoice open and the expired one expired', () => {
    expect(
      isChatPaymentRequestExpired(cardFor('paymentCardInvoice').request, nowMs)
    ).toBe(false)
    expect(
      isChatPaymentRequestExpired(cardFor('paymentCardExpired').request, nowMs)
    ).toBe(true)
  })

  it('shows the expiring-soon invoice inside the warning window', () => {
    const { request } = cardFor('paymentCardExpiringSoon')
    expect(
      request.kind === 'lightning' && getChatInvoiceTiming(request, nowMs).state
    ).toBe('expiringSoon')
  })

  it('marks the no-wallet invoice as unpayable', () => {
    expect(cardFor('paymentCardNoWallet').canPay).toBe(false)
  })

  it('decodes the amounts from the sample requests', () => {
    expect(cardFor('paymentCardInvoice').request.amountSats).toBe(250_000)
    expect(cardFor('paymentCardAmountless').request.amountSats).toBe(0)
    expect(cardFor('paymentCardBitcoin').request.amountSats).toBe(210_000)
    expect(cardFor('paymentCardBitcoinNoAmount').request.amountSats).toBe(0)
  })

  it('shows the unified request as a bitcoin card with a fallback', () => {
    const { request } = cardFor('paymentCardUnified')
    expect(request.kind === 'bitcoin' && request.hasLightningFallback).toBe(
      true
    )
  })

  it('marks the testnet request as testnet and unpayable', () => {
    const card = cardFor('paymentCardNoAccount')
    expect(card.request.network).toBe('testnet')
    expect(card.canPay).toBe(false)
  })

  it('gives the payable invoice at least a few minutes', () => {
    const { request } = cardFor('paymentCardInvoice')
    const expiresAtMs =
      request.kind === 'lightning' && request.expiresAt !== null
        ? request.expiresAt * MS_PER_SECOND
        : 0
    expect(expiresAtMs - nowMs).toBeGreaterThan(5 * 60 * MS_PER_SECOND)
  })
})

describe('design chat sessions', () => {
  it('gives every inbox row its own key', () => {
    const keys = DESIGN_NOSTR_FOLLOWING_CONVERSATIONS.map(getConversationKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('labels both sessions of the peer that has two', () => {
    const labels = labelConversationSessions(
      DESIGN_NOSTR_FOLLOWING_CONVERSATIONS
    ).map((row) => row.sessionLabel)
    expect(labels.filter(Boolean)).toHaveLength(2)
  })

  it('uses valid ids for archived sessions', () => {
    for (const session of DESIGN_NOSTR_ARCHIVED_SESSIONS) {
      expect(session.archived).toBe(true)
      expect(isChatSessionId(session.sessionId)).toBe(true)
    }
  })
})
