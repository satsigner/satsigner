import { MS_PER_MINUTE, MS_PER_SECOND } from '@/constants/time'
import {
  CHAT_INVOICE_EXPIRING_SOON_MS,
  CHAT_PAYMENT_REQUESTS_MAX,
  findChatPaymentRequests,
  getChatInvoiceTiming,
  hasChatInvoice,
  isChatInvoiceExpired,
  isChatPaymentRequestExpired
} from '@/utils/chatPaymentRequests'

// A paid 2100 sat routstr top-up invoice (mainnet, 24h expiry, no description).
const INVOICE =
  'lnbc21u1p40k5ckpp5c5el7qpwgtx6dk497yj2ax93rg0wuwsjyxq06fda6kqh9jujaazqdqqcqzzsxqyz5vqsp57k5d2w84v8eaz437nthxat7e3m3f9cdjfzfmjqh9f3knucrlwsjs9qxpqysgqr2x2f2vdtj7j7l48p8hqvtx5cqvaqzeehky6vqunqr2hghy0xzczuez4faacj6gddjk0vlmxrtzcdj2jk89hxhljyxeplf6gldfm86sqjej445'
const INVOICE_TIMESTAMP = 1_794_855_702
const INVOICE_EXPIRY_SEC = 86_400

// BOLT 11 spec vector: amountless donation invoice.
const AMOUNTLESS_INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql'

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'

describe('findChatPaymentRequests: lightning', () => {
  it('decodes the amount from the invoice, not the surrounding text', () => {
    const [found] = findChatPaymentRequests(`Pay 1 sat please:\n${INVOICE}`)
    expect(found).toStrictEqual({
      amountSats: 2100,
      createdAt: INVOICE_TIMESTAMP,
      description: '',
      expiresAt: INVOICE_TIMESTAMP + INVOICE_EXPIRY_SEC,
      invoice: INVOICE,
      kind: 'lightning',
      network: 'bitcoin'
    })
  })

  it('finds invoices behind a lightning: scheme and in code blocks', () => {
    expect(findChatPaymentRequests(`lightning:${INVOICE}`)).toHaveLength(1)
    expect(findChatPaymentRequests(`\`\`\`\n${INVOICE}\n\`\`\``)).toHaveLength(
      1
    )
  })

  it('matches uppercase invoices and keeps them lowercase', () => {
    const [found] = findChatPaymentRequests(INVOICE.toUpperCase())
    expect(found?.kind === 'lightning' && found.invoice).toBe(INVOICE)
  })

  it('reports amountless invoices as 0 sats', () => {
    const [found] = findChatPaymentRequests(AMOUNTLESS_INVOICE)
    expect(found?.amountSats).toBe(0)
  })

  it('ignores words that merely contain an invoice prefix', () => {
    expect(
      findChatPaymentRequests('the kilnbc oven and lnbc alone')
    ).toStrictEqual([])
    expect(findChatPaymentRequests(`x${INVOICE}`)).toStrictEqual([])
  })

  it('drops strings that look like invoices but fail to decode', () => {
    const corrupted = `${INVOICE.slice(0, -6)}qqqqqq`
    expect(findChatPaymentRequests(corrupted)).toStrictEqual([])
  })

  it('deduplicates and caps the number of requests per message', () => {
    const distinct = [
      INVOICE,
      AMOUNTLESS_INVOICE,
      `bitcoin:${ADDRESS}`,
      `bitcoin:${ADDRESS}?amount=1`
    ]
    const text = [...distinct.slice(0, 3), INVOICE, distinct[3]].join(' ')
    const found = findChatPaymentRequests(text).map((request) =>
      request.kind === 'lightning' ? request.invoice : request.uri
    )
    expect(CHAT_PAYMENT_REQUESTS_MAX).toBe(3)
    expect(found).toStrictEqual(distinct.slice(0, 3))
  })
})

describe('isChatInvoiceExpired', () => {
  const expiresAt = INVOICE_TIMESTAMP + INVOICE_EXPIRY_SEC

  it('is expired at and after expiresAt', () => {
    expect(isChatInvoiceExpired({ expiresAt }, expiresAt * 1000)).toBe(true)
    expect(isChatInvoiceExpired({ expiresAt }, expiresAt * 1000 - 1)).toBe(
      false
    )
  })

  it('never expires without a timestamp', () => {
    expect(isChatInvoiceExpired({ expiresAt: null })).toBe(false)
  })
})

const BITCOIN_URI = `bitcoin:${ADDRESS}?amount=0.0021&label=Pizza%20night&message=Split%20for%20Friday`

describe('findChatPaymentRequests: bitcoin URIs', () => {
  it('reads the amount, label and message of a bip21 URI', () => {
    expect(
      findChatPaymentRequests(`Can you send ${BITCOIN_URI} ?`)
    ).toStrictEqual([
      {
        address: ADDRESS,
        amountSats: 210_000,
        hasLightningFallback: false,
        kind: 'bitcoin',
        label: 'Pizza night',
        message: 'Split for Friday',
        network: 'bitcoin',
        uri: BITCOIN_URI
      }
    ])
  })

  it('reports a URI without amount as 0 sats', () => {
    const [found] = findChatPaymentRequests(`bitcoin:${ADDRESS}`)
    expect(found?.amountSats).toBe(0)
  })

  it('drops prose punctuation and markdown around the URI', () => {
    const [fromSentence] = findChatPaymentRequests(`Pay to ${BITCOIN_URI}.`)
    const [fromLink] = findChatPaymentRequests(`[pay](${BITCOIN_URI})`)
    const [fromBold] = findChatPaymentRequests(`**${BITCOIN_URI}**`)
    expect(fromSentence?.kind === 'bitcoin' && fromSentence.uri).toBe(
      BITCOIN_URI
    )
    expect(fromLink?.kind === 'bitcoin' && fromLink.uri).toBe(BITCOIN_URI)
    expect(fromBold?.kind === 'bitcoin' && fromBold.uri).toBe(BITCOIN_URI)
  })

  it('keeps balanced parentheses inside the URI', () => {
    const uri = `bitcoin:${ADDRESS}?label=Lunch(Friday)&amount=0.0021`
    const [inProse] = findChatPaymentRequests(`Pay ${uri} today`)
    const [inLink] = findChatPaymentRequests(`[pay](${uri})`)
    expect(inProse?.amountSats).toBe(210_000)
    expect(inProse?.kind === 'bitcoin' && inProse.uri).toBe(uri)
    expect(inLink?.kind === 'bitcoin' && inLink.uri).toBe(uri)
  })

  it('shows a unified URI as one card with a lightning fallback', () => {
    const requests = findChatPaymentRequests(
      `bitcoin:${ADDRESS}?amount=0.000021&lightning=${INVOICE}`
    )
    expect(requests).toHaveLength(1)
    expect(
      requests[0]?.kind === 'bitcoin' && requests[0].hasLightningFallback
    ).toBe(true)
  })

  it('reads a lightning-only bitcoin: URI as an invoice', () => {
    const [found] = findChatPaymentRequests(`bitcoin:?lightning=${INVOICE}`)
    expect(found?.kind).toBe('lightning')
  })

  it('drops URIs with unknown required params or broken encoding', () => {
    expect(
      findChatPaymentRequests(`bitcoin:${ADDRESS}?amount=0.01&req-foo=1`)
    ).toStrictEqual([])
    expect(
      findChatPaymentRequests(`bitcoin:${ADDRESS}?label=100%`)
    ).toStrictEqual([])
  })

  it('keeps invoices and URIs in reading order', () => {
    const kinds = findChatPaymentRequests(`${BITCOIN_URI} or ${INVOICE}`).map(
      (request) => request.kind
    )
    expect(kinds).toStrictEqual(['bitcoin', 'lightning'])
  })
})

describe('isChatPaymentRequestExpired', () => {
  it('never expires bitcoin URIs', () => {
    const [found] = findChatPaymentRequests(BITCOIN_URI)
    expect(
      found && isChatPaymentRequestExpired(found, Number.MAX_SAFE_INTEGER)
    ).toBe(false)
  })
})

describe('getChatInvoiceTiming', () => {
  const expiresAt = INVOICE_TIMESTAMP + INVOICE_EXPIRY_SEC
  const expiresAtMs = expiresAt * MS_PER_SECOND

  it('is open while well before expiry', () => {
    expect(
      getChatInvoiceTiming(
        { expiresAt },
        expiresAtMs - CHAT_INVOICE_EXPIRING_SOON_MS - MS_PER_MINUTE
      )
    ).toStrictEqual({ expiresAtMs, state: 'open' })
  })

  it('is expiring soon inside the warning window', () => {
    expect(
      getChatInvoiceTiming({ expiresAt }, expiresAtMs - MS_PER_MINUTE)
    ).toStrictEqual({ expiresAtMs, state: 'expiringSoon' })
  })

  it('is expired at and after expiry', () => {
    expect(getChatInvoiceTiming({ expiresAt }, expiresAtMs)).toStrictEqual({
      expiresAtMs,
      state: 'expired'
    })
  })

  it('is unknown without a timestamp', () => {
    expect(getChatInvoiceTiming({ expiresAt: null }, 0)).toStrictEqual({
      state: 'unknown'
    })
  })
})

describe('hasChatInvoice', () => {
  it('is true when a message carries a decoded invoice', () => {
    expect(hasChatInvoice(findChatPaymentRequests(`pay ${INVOICE}`))).toBe(true)
  })

  it('is false for bitcoin URIs only, including unified ones', () => {
    expect(hasChatInvoice(findChatPaymentRequests(BITCOIN_URI))).toBe(false)
    expect(
      hasChatInvoice(
        findChatPaymentRequests(
          `bitcoin:${ADDRESS}?amount=0.000021&lightning=${INVOICE}`
        )
      )
    ).toBe(false)
  })

  it('is false for invoices that fail to decode', () => {
    const corrupted = `${INVOICE.slice(0, -6)}qqqqqq`
    expect(hasChatInvoice(findChatPaymentRequests(corrupted))).toBe(false)
  })
})
