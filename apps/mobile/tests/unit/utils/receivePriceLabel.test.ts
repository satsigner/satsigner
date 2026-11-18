import { formatDate, formatNumber } from '@/utils/format'
import { appendLabelNote, buildPriceLabelNote } from '@/utils/receivePriceLabel'

const date = new Date(2026, 8, 16)
const rate = `${formatDate(date)} (1 BTC = ${formatNumber(81_880)} USD)`

describe('buildPriceLabelNote', () => {
  it('writes the date and rate', () => {
    expect(buildPriceLabelNote({ currency: 'USD', date, price: 81_880 })).toBe(
      rate
    )
  })

  it('leads with the fiat amount when there is one', () => {
    expect(
      buildPriceLabelNote({
        currency: 'USD',
        date,
        fiatAmount: 25,
        price: 81_880
      })
    ).toBe(`25.00 USD on ${rate}`)
  })
})

describe('appendLabelNote', () => {
  it('uses the note as the label when empty', () => {
    expect(appendLabelNote('  ', rate)).toBe(rate)
  })

  it('appends to an existing label', () => {
    expect(appendLabelNote('Logo design', rate)).toBe(`Logo design, ${rate}`)
  })

  it('does not add the same note twice', () => {
    expect(appendLabelNote(`Logo design, ${rate}`, rate)).toBe(
      `Logo design, ${rate}`
    )
  })
})
