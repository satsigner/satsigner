import { MILLISATS_PER_SAT } from '@/constants/btc'
import {
  bolt11AmountSats,
  isAmountlessBolt11Invoice
} from '@/utils/lightningInvoiceDecoder'
import {
  buildLndPayInvoiceBody,
  parsePositiveSats
} from '@/utils/lndPayInvoice'

describe('parsePositiveSats', () => {
  it('rejects empty, zero, and non-numeric values', () => {
    expect(parsePositiveSats('')).toBeNull()
    expect(parsePositiveSats('0')).toBeNull()
    expect(parsePositiveSats('-1')).toBeNull()
    expect(parsePositiveSats('abc')).toBeNull()
  })

  it('parses a positive sat amount', () => {
    expect(parsePositiveSats('21')).toBe(21)
  })
})

describe('buildLndPayInvoiceBody', () => {
  it('omits amt when the invoice already has an amount', () => {
    expect(buildLndPayInvoiceBody('lnbc1invoice')).toStrictEqual({
      payment_request: 'lnbc1invoice'
    })
  })

  it('includes amt for amountless invoices', () => {
    expect(buildLndPayInvoiceBody('lnbc1invoice', 2100)).toStrictEqual({
      amt: '2100',
      payment_request: 'lnbc1invoice'
    })
  })
})

describe('bolt11AmountSats', () => {
  it('treats missing and zero amounts as amountless', () => {
    expect(bolt11AmountSats({ num_msat: '0', num_satoshis: '0' })).toBe(0)
    expect(isAmountlessBolt11Invoice({ num_satoshis: '0' })).toBe(true)
  })

  it('reads sats, then msats, then value', () => {
    expect(bolt11AmountSats({ num_satoshis: '100' })).toBe(100)
    expect(
      bolt11AmountSats({
        num_msat: String(2 * MILLISATS_PER_SAT),
        num_satoshis: '0'
      })
    ).toBe(2)
    expect(bolt11AmountSats({ value: '50' })).toBe(50)
    expect(isAmountlessBolt11Invoice({ num_satoshis: '100' })).toBe(false)
  })
})
