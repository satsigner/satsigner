import { shouldSuppressPayjoinTransactionChart } from '@/utils/payjoinSignPreview'

describe('shouldSuppressPayjoinTransactionChart', () => {
  it('hides the chart while Payjoin is still negotiating', () => {
    expect(
      shouldSuppressPayjoinTransactionChart({
        negotiating: true,
        signed: false
      })
    ).toBe(true)
  })

  it('shows the signed Payjoin transaction before broadcast', () => {
    expect(
      shouldSuppressPayjoinTransactionChart({
        negotiating: true,
        signed: true
      })
    ).toBe(false)
  })

  it('does not hide a normal signed transaction', () => {
    expect(
      shouldSuppressPayjoinTransactionChart({
        negotiating: false,
        signed: true
      })
    ).toBe(false)
    expect(
      shouldSuppressPayjoinTransactionChart({
        negotiating: false,
        signed: false
      })
    ).toBe(false)
  })
})
