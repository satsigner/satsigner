import {
  formatPayjoinSummary,
  parsePayjoinInvoice
} from '@/utils/payjoinInvoice'

const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
const PJ = 'https://example.com/payjoin'

describe('parsePayjoinInvoice', () => {
  it('returns undefined without a payjoin endpoint', () => {
    expect(parsePayjoinInvoice(undefined)).toBeUndefined()
    expect(
      parsePayjoinInvoice(`bitcoin:${ADDRESS}?amount=0.001`)
    ).toBeUndefined()
  })

  it('parses address, amount in sats and endpoint', () => {
    const uri = `bitcoin:${ADDRESS}?amount=0.001&label=shop&pj=${PJ}`
    expect(parsePayjoinInvoice(uri)).toMatchObject({
      address: ADDRESS,
      amountSats: 100_000,
      label: 'shop',
      pj: PJ,
      uri
    })
  })

  it('leaves the amount unset when the URI has none', () => {
    expect(
      parsePayjoinInvoice(`bitcoin:${ADDRESS}?pj=${PJ}`)?.amountSats
    ).toBeUndefined()
  })
})

describe('formatPayjoinSummary', () => {
  it('joins the non-empty invoice parts', () => {
    const invoice = parsePayjoinInvoice(
      `bitcoin:${ADDRESS}?amount=0.001&label=shop&pj=${PJ}`
    )
    if (!invoice) {
      throw new Error('expected an invoice')
    }
    const summary = formatPayjoinSummary(invoice, null)
    expect(summary).toContain('100,000')
    expect(summary).toContain('shop')
    expect(summary.split(' · ')).toHaveLength(4)
  })
})
