import type { ArkAccount } from '@/types/models/Ark'
import { buildPaymentMethods } from '@/utils/paymentMethods'

const arkAccount = (overrides: Partial<ArkAccount> = {}): ArkAccount => ({
  bitcoinAccountId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  id: 'ark-acc-1',
  name: 'My Ark',
  network: 'bitcoin',
  serverId: 'second',
  ...overrides
})

describe('buildPaymentMethods', () => {
  it('returns empty list when no sources are configured', () => {
    expect(buildPaymentMethods(null, [])).toStrictEqual([])
  })

  it('includes lightning when configured', () => {
    const methods = buildPaymentMethods({ url: 'https://lnd.example' }, [])
    expect(methods).toHaveLength(1)
    expect(methods[0]).toMatchObject({
      id: 'lightning',
      type: 'lightning'
    })
  })

  it('includes ecash mints', () => {
    const methods = buildPaymentMethods(null, [
      { name: 'Mint A', url: 'https://mint-a.example' }
    ])
    expect(methods).toHaveLength(1)
    expect(methods[0]).toMatchObject({
      id: 'ecash-https://mint-a.example',
      type: 'ecash'
    })
  })

  it('includes ark accounts with structured accountId', () => {
    const account = arkAccount({ id: 'abc-123', name: 'Signet Ark' })
    const methods = buildPaymentMethods(null, [], [account])
    expect(methods).toHaveLength(1)
    expect(methods[0]).toMatchObject({
      accountId: 'abc-123',
      detail: 'Signet Ark',
      id: 'ark-abc-123',
      type: 'ark'
    })
  })

  it('combines all sources in lightning, ecash, ark order', () => {
    const methods = buildPaymentMethods(
      { url: 'https://lnd.example' },
      [{ url: 'https://mint.example' }],
      [arkAccount()]
    )
    expect(methods.map((m) => m.type)).toStrictEqual([
      'lightning',
      'ecash',
      'ark'
    ])
  })

  it('treats arkAccounts as optional', () => {
    expect(() =>
      buildPaymentMethods({ url: 'https://lnd.example' }, [])
    ).not.toThrow()
  })
})
