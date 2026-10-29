import type { ArkAccount } from '@/types/models/Ark'
import {
  buildPaymentMethods,
  getAutoPaymentMethod,
  getInvoicePayRoute
} from '@/utils/paymentMethods'

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

  it('includes ecash accounts with aggregated balance', () => {
    const methods = buildPaymentMethods(
      null,
      [{ id: 'acc-1', name: 'Mint A' }],
      { 'acc-1': [{ balance: 50 }, { balance: 50 }] }
    )
    expect(methods).toHaveLength(1)
    expect(methods[0]).toMatchObject({
      balanceSats: 100,
      id: 'ecash-acc-1',
      label: 'Mint A',
      type: 'ecash'
    })
  })

  it('includes ark accounts with structured accountId', () => {
    const account = arkAccount({ id: 'abc-123', name: 'Signet Ark' })
    const methods = buildPaymentMethods(null, [], {}, [account])
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
      [{ id: 'acc-1', name: 'Mint' }],
      {},
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

describe('getAutoPaymentMethod', () => {
  const lightning = {
    id: 'lightning',
    label: 'Node',
    type: 'lightning' as const
  }
  const ecash = {
    accountId: 'e1',
    id: 'ecash-e1',
    label: 'Mint',
    type: 'ecash' as const
  }
  const autoEcash = {
    autoApprove: true,
    autoApproveWalletId: 'ecash-e1',
    oneTapAmount: 21,
    presetAmounts: [21]
  }

  it('uses the auto-approve wallet when it still exists', () => {
    expect(getAutoPaymentMethod([lightning, ecash], autoEcash)).toBe(ecash)
  })

  it('asks when the auto-approve wallet is gone and there is a choice', () => {
    expect(
      getAutoPaymentMethod([lightning, { ...ecash, id: 'ecash-e2' }], autoEcash)
    ).toBeNull()
  })

  it('ignores the saved wallet when auto-approve is off', () => {
    expect(
      getAutoPaymentMethod([lightning, ecash], {
        ...autoEcash,
        autoApprove: false
      })
    ).toBeNull()
  })

  it('uses the only wallet without asking', () => {
    expect(getAutoPaymentMethod([lightning])).toBe(lightning)
  })

  it('returns nothing when there is no wallet', () => {
    expect(getAutoPaymentMethod([])).toBeNull()
  })
})

describe('getInvoicePayRoute', () => {
  it('routes each wallet type to its pay screen', () => {
    expect(
      getInvoicePayRoute(
        { id: 'lightning', label: 'Node', type: 'lightning' },
        'lnbc1',
        21
      )
    ).toStrictEqual({
      params: { invoice: 'lnbc1' },
      pathname: '/signer/lightning/pay'
    })
    expect(
      getInvoicePayRoute(
        { accountId: 'e1', id: 'ecash-e1', label: 'Mint', type: 'ecash' },
        'lnbc1',
        21
      )
    ).toStrictEqual({
      params: { invoice: 'lnbc1' },
      pathname: '/signer/ecash/send'
    })
    expect(
      getInvoicePayRoute(
        { accountId: 'a1', id: 'ark-a1', label: 'Ark', type: 'ark' },
        'lnbc1',
        21
      )
    ).toStrictEqual({
      params: { amountSats: '21', id: 'a1', invoice: 'lnbc1' },
      pathname: '/signer/ark/account/[id]/pay-invoice'
    })
  })

  it('has no route for an Ark wallet without an account', () => {
    expect(
      getInvoicePayRoute({ id: 'ark', label: 'Ark', type: 'ark' }, 'lnbc1', 21)
    ).toBeNull()
  })
})
