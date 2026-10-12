import { type BrantaPayee } from '@/types/models/Branta'
import { type Transaction } from '@/types/models/Transaction'
import {
  attachBrantaPayees,
  paymentHistoryLabel,
  payeesFromOutputs,
  selectTransactionPayee,
  toBrantaPayee
} from '@/utils/brantaPayee'

const payee: BrantaPayee = {
  description: 'March invoice',
  logoUrl: 'https://example.com/logo.png',
  name: 'Acme',
  parentLogoUrl: 'https://example.com/parent.png',
  verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
}

describe('toBrantaPayee', () => {
  it('maps the first payment and trims display fields', () => {
    expect(
      toBrantaPayee({
        payments: [
          {
            description: '  March invoice  ',
            parentPlatform: { logoUrl: ' https://example.com/parent.png ' },
            platform: ' Acme ',
            platformLogoUrl: ' https://example.com/logo.png '
          }
        ],
        verifyUrl: ' https://guardrail.branta.pro/v2/verify/abc '
      })
    ).toStrictEqual(payee)
  })

  it('returns null when Branta has no payment', () => {
    expect(
      toBrantaPayee({
        payments: [],
        verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
      })
    ).toBeNull()
  })

  it('returns null when the platform name is missing', () => {
    expect(
      toBrantaPayee({
        payments: [{ platformLogoUrl: 'https://example.com/logo.png' }],
        verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
      })
    ).toBeNull()
  })
})

describe('payment history payees', () => {
  const outputs = [
    { branta: payee, label: 'Rent' },
    { branta: payee, kind: 'change' as const, label: 'Change' },
    { label: '' }
  ]

  it('keeps recipient payees and drops change outputs', () => {
    expect(payeesFromOutputs(outputs)).toStrictEqual([payee])
    expect(selectTransactionPayee(outputs)).toStrictEqual(payee)
  })

  it('adds the payee name to the transaction label without duplicating it', () => {
    expect(paymentHistoryLabel(outputs, 'Change')).toBe('Rent,Acme')
    expect(
      paymentHistoryLabel([{ branta: payee, label: 'Acme' }], 'Change')
    ).toBe('Acme')
  })

  it('uses the payee name when the output has no label', () => {
    expect(paymentHistoryLabel([{ branta: payee, label: '' }], 'Change')).toBe(
      'Acme'
    )
  })
})

describe('attachBrantaPayees', () => {
  it('attaches a stored payee onto the matching transaction', () => {
    const transactions = [
      { id: 'tx-1', label: '' },
      { id: 'tx-2', label: '' }
    ] as Transaction[]

    const attached = attachBrantaPayees(
      transactions,
      new Map([['tx-1', payee]])
    )

    expect(attached[0]?.branta).toStrictEqual(payee)
    expect(attached[1]?.branta).toBeUndefined()
  })
})
