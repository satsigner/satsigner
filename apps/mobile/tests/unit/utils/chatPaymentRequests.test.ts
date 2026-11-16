import {
  CHAT_PAYMENT_REQUESTS_MAX,
  findChatInvoices,
  isChatInvoiceExpired
} from '@/utils/chatPaymentRequests'

// A paid 2100 sat routstr top-up invoice (mainnet, 24h expiry, no description).
const INVOICE =
  'lnbc21u1p40k5ckpp5c5el7qpwgtx6dk497yj2ax93rg0wuwsjyxq06fda6kqh9jujaazqdqqcqzzsxqyz5vqsp57k5d2w84v8eaz437nthxat7e3m3f9cdjfzfmjqh9f3knucrlwsjs9qxpqysgqr2x2f2vdtj7j7l48p8hqvtx5cqvaqzeehky6vqunqr2hghy0xzczuez4faacj6gddjk0vlmxrtzcdj2jk89hxhljyxeplf6gldfm86sqjej445'
const INVOICE_TIMESTAMP = 1_794_855_702
const INVOICE_EXPIRY_SEC = 86_400

// BOLT 11 spec vector: amountless donation invoice.
const AMOUNTLESS_INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql'

describe('findChatInvoices', () => {
  it('decodes the amount from the invoice, not the surrounding text', () => {
    const [found] = findChatInvoices(`Pay 1 sat please:\n${INVOICE}`)
    expect(found).toStrictEqual({
      amountSats: 2100,
      description: '',
      expiresAt: INVOICE_TIMESTAMP + INVOICE_EXPIRY_SEC,
      invoice: INVOICE,
      network: 'bitcoin'
    })
  })

  it('finds invoices behind a lightning: scheme and in code blocks', () => {
    expect(findChatInvoices(`lightning:${INVOICE}`)).toHaveLength(1)
    expect(findChatInvoices(`\`\`\`\n${INVOICE}\n\`\`\``)).toHaveLength(1)
  })

  it('matches uppercase invoices and keeps them lowercase', () => {
    const [found] = findChatInvoices(INVOICE.toUpperCase())
    expect(found?.invoice).toBe(INVOICE)
  })

  it('reports amountless invoices as 0 sats', () => {
    const [found] = findChatInvoices(AMOUNTLESS_INVOICE)
    expect(found?.amountSats).toBe(0)
  })

  it('ignores words that merely contain an invoice prefix', () => {
    expect(findChatInvoices('the kilnbc oven and lnbc alone')).toStrictEqual([])
    expect(findChatInvoices(`x${INVOICE}`)).toStrictEqual([])
  })

  it('drops strings that look like invoices but fail to decode', () => {
    const corrupted = `${INVOICE.slice(0, -6)}qqqqqq`
    expect(findChatInvoices(corrupted)).toStrictEqual([])
  })

  it('deduplicates and caps the number of invoices per message', () => {
    const text = Array.from(
      { length: CHAT_PAYMENT_REQUESTS_MAX + 2 },
      (_, index) => (index % 2 === 0 ? INVOICE : AMOUNTLESS_INVOICE)
    ).join(' ')
    expect(findChatInvoices(text)).toHaveLength(2)
    expect(findChatInvoices(`${INVOICE} ${INVOICE}`)).toHaveLength(1)
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
