import {
  lndInvoiceLookupPath,
  parseLndInvoiceUiStatus
} from '@/utils/lndInvoiceStatus'

describe('parseLndInvoiceUiStatus', () => {
  it('maps settled and canceled, otherwise open', () => {
    expect(parseLndInvoiceUiStatus('SETTLED')).toBe('settled')
    expect(parseLndInvoiceUiStatus('Canceled')).toBe('canceled')
    expect(parseLndInvoiceUiStatus('OPEN')).toBe('open')
    expect(parseLndInvoiceUiStatus('unknown')).toBe('open')
  })
})

describe('lndInvoiceLookupPath', () => {
  it('encodes a base64 r_hash as hex', () => {
    expect(
      lndInvoiceLookupPath(Buffer.from('ab', 'utf8').toString('base64'))
    ).toBe('/v1/invoice/6162')
  })
})
