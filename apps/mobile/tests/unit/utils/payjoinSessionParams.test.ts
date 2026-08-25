import { type PayjoinSession } from '@/types/payjoin'
import { withReceiverSessionBip21Params } from '@/utils/payjoinSessionParams'

function baseSession(overrides?: Partial<PayjoinSession>): PayjoinSession {
  return {
    accountId: 'acc-1',
    address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
    createdAt: 1,
    expiresAt: Date.now() + 60_000,
    id: 'pj_test',
    pjEndpoint: 'https://payjo.in/mb#RK1-x',
    pjos: 0,
    protocol: 'v2',
    role: 'receiver',
    status: 'waiting',
    updatedAt: 1,
    uri: 'bitcoin:tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx?pjos=0&pj=https://payjo.in/mb%23RK1-x',
    ...overrides
  }
}

describe('withReceiverSessionBip21Params', () => {
  it('writes amount into session + URI after a no-amount create', () => {
    const created = baseSession()
    const synced = withReceiverSessionBip21Params(created, {
      amountSats: 21_000,
      label: 'invoice'
    })

    expect(synced).not.toBe(created)
    expect(synced.amountSats).toBe(21_000)
    expect(synced.label).toBe('invoice')
    expect(synced.uri).toContain('amount=0.00021')
    expect(synced.uri).toContain('label=invoice')
    expect(synced.uri).toContain('pj=https://payjo.in/mb%23RK1-x')
  })

  it('returns the same object when amount/label already match', () => {
    const withAmount = withReceiverSessionBip21Params(baseSession(), {
      amountSats: 10_000
    })
    const again = withReceiverSessionBip21Params(withAmount, {
      amountSats: 10_000
    })
    expect(again).toBe(withAmount)
  })

  it('clears amount from session when the form amount is removed', () => {
    const withAmount = withReceiverSessionBip21Params(baseSession(), {
      amountSats: 5_000
    })
    const cleared = withReceiverSessionBip21Params(withAmount, {
      amountSats: undefined
    })

    expect(cleared.amountSats).toBeUndefined()
    expect(cleared.uri).not.toContain('amount=')
  })
})
