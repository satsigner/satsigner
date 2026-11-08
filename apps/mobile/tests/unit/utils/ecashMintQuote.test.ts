import { isMintQuoteSettled, toMintQuotePollStep } from '@/utils/ecashMintQuote'

describe('toMintQuotePollStep', () => {
  it.each([
    ['PENDING', 'wait'],
    ['UNPAID', 'wait'],
    ['PAID', 'mint'],
    ['ISSUED', 'issued'],
    ['EXPIRED', 'failed'],
    ['CANCELLED', 'failed']
  ] as const)('maps %s to %s', (state, step) => {
    expect(toMintQuotePollStep(state)).toBe(step)
  })

  it('treats every state but a waiting one as settled', () => {
    expect(isMintQuoteSettled('UNPAID')).toBe(false)
    expect(isMintQuoteSettled('ISSUED')).toBe(true)
  })
})
