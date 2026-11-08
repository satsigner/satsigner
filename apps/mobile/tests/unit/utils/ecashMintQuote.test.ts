import {
  ECASH_MINT_QUOTE_EXPIRY_GRACE_MS,
  ECASH_PENDING_MINT_FAST_POLL_WINDOW_MS,
  ECASH_PENDING_MINT_MAX_AGE_MS,
  ECASH_PENDING_MINT_SLOW_POLL_INTERVAL_MS,
  ECASH_QUOTE_POLL_INTERVAL_MS
} from '@/constants/ecash'
import { MS_PER_SECOND } from '@/constants/time'
import type { EcashTransaction } from '@/types/models/Ecash'
import {
  hasPendingMints,
  listPendingMints,
  pendingMintPollInterval,
  toMintInvoiceStatus,
  toPendingMintStep
} from '@/utils/ecashMintQuote'

const NOW = Date.parse('2026-01-01T12:00:00.000Z')
const EXPIRY_SECONDS = NOW / MS_PER_SECOND

function transaction(overrides: Partial<EcashTransaction>): EcashTransaction {
  return {
    amount: 100,
    expiry: EXPIRY_SECONDS,
    id: 'q1',
    mintUrl: 'https://mint.example',
    quoteId: 'q1',
    status: 'pending',
    timestamp: new Date(NOW).toISOString(),
    type: 'mint',
    ...overrides
  }
}

describe('toPendingMintStep', () => {
  it.each([
    ['PAID', 'mint'],
    ['ISSUED', 'fail'],
    ['EXPIRED', 'expire'],
    ['CANCELLED', 'fail']
  ] as const)('maps %s to %s', (state, step) => {
    expect(toPendingMintStep(state, NOW, NOW)).toBe(step)
  })

  it('waits for an unpaid quote until its deadline passes', () => {
    expect(toPendingMintStep('UNPAID', NOW, NOW)).toBe('wait')
    expect(toPendingMintStep('UNPAID', NOW, NOW + 1)).toBe('expire')
  })

  it('keeps waiting on a payment in flight past the deadline', () => {
    expect(toPendingMintStep('PENDING', NOW, NOW + 1)).toBe('wait')
  })

  it('mints a paid quote past the deadline', () => {
    expect(toPendingMintStep('PAID', NOW, NOW + 1)).toBe('mint')
  })
})

describe('listPendingMints', () => {
  it('lists pending mint transactions of every known account', () => {
    const pending = listPendingMints({
      accounts: [{ id: 'a' }, { id: 'b' }],
      transactions: {
        a: [
          transaction({ id: 'qa', quoteId: 'qa' }),
          transaction({ id: 'done', status: 'completed' }),
          transaction({ id: 'melt', type: 'melt' }),
          transaction({ id: 'noQuote', quoteId: undefined })
        ],
        b: [transaction({ id: 'qb', quoteId: 'qb' })],
        removed: [transaction({ id: 'qr', quoteId: 'qr' })]
      }
    })

    expect(
      pending.map(({ accountId, quoteId }) => [accountId, quoteId])
    ).toStrictEqual([
      ['a', 'qa'],
      ['b', 'qb']
    ])
  })

  it('gives an unpaid quote a grace period after its invoice expiry', () => {
    const [pending] = listPendingMints({
      accounts: [{ id: 'a' }],
      transactions: { a: [transaction({})] }
    })

    expect(pending.deadline).toBe(NOW + ECASH_MINT_QUOTE_EXPIRY_GRACE_MS)
  })

  it('falls back to a maximum age when the mint gave no expiry', () => {
    const [pending] = listPendingMints({
      accounts: [{ id: 'a' }],
      transactions: { a: [transaction({ expiry: undefined })] }
    })

    expect(pending.deadline).toBe(NOW + ECASH_PENDING_MINT_MAX_AGE_MS)
  })

  it('reports whether anything is pending', () => {
    expect(
      hasPendingMints({ accounts: [{ id: 'a' }], transactions: { a: [] } })
    ).toBe(false)
    expect(
      hasPendingMints({
        accounts: [{ id: 'a' }],
        transactions: { a: [transaction({})] }
      })
    ).toBe(true)
  })
})

describe('pendingMintPollInterval', () => {
  const [pending] = listPendingMints({
    accounts: [{ id: 'a' }],
    transactions: { a: [transaction({})] }
  })

  it('stops when nothing is pending', () => {
    expect(pendingMintPollInterval([], NOW)).toBe(false)
  })

  it('polls fast while an invoice is fresh, then slower', () => {
    expect(pendingMintPollInterval([pending], NOW)).toBe(
      ECASH_QUOTE_POLL_INTERVAL_MS
    )
    expect(
      pendingMintPollInterval(
        [pending],
        NOW + ECASH_PENDING_MINT_FAST_POLL_WINDOW_MS
      )
    ).toBe(ECASH_PENDING_MINT_SLOW_POLL_INTERVAL_MS)
  })
})

describe('toMintInvoiceStatus', () => {
  it.each([
    [undefined, 'waiting'],
    ['pending', 'waiting'],
    ['completed', 'received'],
    ['settled', 'received'],
    ['expired', 'expired'],
    ['failed', 'failed']
  ] as const)('maps %s to %s', (status, invoiceStatus) => {
    expect(toMintInvoiceStatus(status)).toBe(invoiceStatus)
  })
})
