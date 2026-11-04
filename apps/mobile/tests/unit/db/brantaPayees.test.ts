import { getDb } from '@/db/connection'
import { saveBrantaPayee } from '@/db/mutations/brantaPayees'
import { getBrantaPayeesByAccount } from '@/db/queries/brantaPayees'
import { type BrantaPayee } from '@/types/models/Branta'

import { mockQueryResult } from './queryResult'

const execute = jest.mocked(getDb().execute)

const payee: BrantaPayee = {
  description: 'March invoice',
  logoUrl: 'https://example.com/logo.png',
  name: 'Acme',
  parentLogoUrl: 'https://example.com/parent.png',
  verifyUrl: 'https://guardrail.branta.pro/v2/verify/abc'
}

describe('branta payees db', () => {
  beforeEach(() => {
    getDb()
    execute.mockClear()
    execute.mockReturnValue(mockQueryResult())
  })

  it('upserts the payee for the broadcast transaction', () => {
    saveBrantaPayee('account-1', 'tx-1', payee)

    expect(execute).toHaveBeenCalledWith(
      expect.stringMatching(/INSERT INTO branta_payees[\s\S]*ON CONFLICT/),
      [
        'account-1',
        'tx-1',
        'Acme',
        'https://example.com/logo.png',
        'March invoice',
        'https://guardrail.branta.pro/v2/verify/abc',
        'https://example.com/parent.png'
      ]
    )
  })

  it('reads stored payees keyed by transaction id', () => {
    execute.mockReturnValue(
      mockQueryResult([
        {
          account_id: 'account-1',
          description: payee.description,
          logo_url: payee.logoUrl,
          name: payee.name,
          parent_logo_url: payee.parentLogoUrl,
          tx_id: 'tx-1',
          verify_url: payee.verifyUrl
        }
      ])
    )

    expect(getBrantaPayeesByAccount('account-1').get('tx-1')).toStrictEqual(
      payee
    )
  })
})
