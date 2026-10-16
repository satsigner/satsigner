import { type QueryState } from '@tanstack/react-query'

import { ECASH_QUOTE_POLL_MAX_ATTEMPTS } from '@/constants/ecash'
import {
  checkMintQuoteOnce,
  shouldKeepPolling
} from '@/hooks/useEcashMintQuotePolling'
import type { MintQuoteState } from '@/types/models/Ecash'

function state(
  data: MintQuoteState | undefined,
  dataUpdateCount = 1,
  errorUpdateCount = 0
): QueryState<MintQuoteState> {
  return {
    data,
    dataUpdateCount,
    dataUpdatedAt: 0,
    error: null,
    errorUpdateCount,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    fetchStatus: 'idle',
    isInvalidated: false,
    status: data ? 'success' : 'pending'
  }
}

describe('shouldKeepPolling', () => {
  it('keeps polling while the quote is unpaid', () => {
    expect(shouldKeepPolling(state('UNPAID'))).toBe(true)
    expect(shouldKeepPolling(state(undefined, 0, 3))).toBe(true)
  })

  it.each(['PAID', 'ISSUED', 'EXPIRED', 'CANCELLED'] as const)(
    'stops once the quote is %s',
    (quoteState) => {
      expect(shouldKeepPolling(state(quoteState))).toBe(false)
    }
  )

  it('stops after the attempt budget, counting failures', () => {
    expect(
      shouldKeepPolling(state('PENDING', ECASH_QUOTE_POLL_MAX_ATTEMPTS - 1, 1))
    ).toBe(false)
  })
})

describe('checkMintQuoteOnce', () => {
  function params(quoteState: MintQuoteState) {
    return {
      checkMintQuote: jest.fn().mockResolvedValue(quoteState),
      mintUrl: 'https://mint.example',
      onFailed: jest.fn(),
      onPaid: jest.fn().mockResolvedValue(undefined),
      quoteId: `q-${quoteState}`
    }
  }

  it('claims a paid quote', async () => {
    const p = params('PAID')

    await expect(checkMintQuoteOnce(p)).resolves.toBe('PAID')
    expect(p.onPaid).toHaveBeenCalledTimes(1)
    expect(p.onFailed).not.toHaveBeenCalled()
  })

  it('does nothing while the quote is unpaid', async () => {
    const p = params('UNPAID')

    await checkMintQuoteOnce(p)

    expect(p.onPaid).not.toHaveBeenCalled()
    expect(p.onFailed).not.toHaveBeenCalled()
  })

  it('reports an expired quote once', async () => {
    const p = params('EXPIRED')

    await checkMintQuoteOnce(p)

    expect(p.onFailed).toHaveBeenCalledTimes(1)
    expect(p.onPaid).not.toHaveBeenCalled()
  })

  it('does not claim the same quote twice at the same time', async () => {
    const p = params('ISSUED')

    await Promise.all([checkMintQuoteOnce(p), checkMintQuoteOnce(p)])

    expect(p.onPaid).toHaveBeenCalledTimes(1)
  })
})
