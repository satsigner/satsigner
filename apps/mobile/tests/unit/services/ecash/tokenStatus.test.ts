import { validateEcashToken } from '@/api/ecash'
import {
  refreshSendTokenStatuses,
  resolveTokenStatus,
  selectSendTokensToCheck
} from '@/services/ecash/tokenStatus'
import type { EcashTransaction } from '@/types/models/Ecash'

jest.mock<typeof import('@/api/ecash')>('@/api/ecash', () => ({
  __esModule: true,
  validateEcashToken: jest.fn()
}))

function sendTx(overrides: Partial<EcashTransaction> = {}): EcashTransaction {
  return {
    amount: 10,
    id: 'tx1',
    mintUrl: 'https://mint.example',
    timestamp: '2026-01-01T00:00:00.000Z',
    token: 'cashuA123',
    type: 'send',
    ...overrides
  }
}

describe('resolveTokenStatus', () => {
  it.each([
    [{ isValid: false }, 'invalid'],
    [{ isSpent: true, isValid: true }, 'spent'],
    [{ isSpent: false, isValid: true }, 'unspent'],
    [{ details: 'Token Pending', isValid: true }, 'pending'],
    [{ isValid: true }, undefined]
  ])('maps %o to %s', (result, expected) => {
    expect(resolveTokenStatus(result)).toBe(expected)
  })
})

describe('selectSendTokensToCheck', () => {
  it('keeps sent tokens that may still change and are not being checked', () => {
    const transactions = [
      sendTx({ id: 'a' }),
      sendTx({ id: 'b', tokenStatus: 'spent' }),
      sendTx({ id: 'c', type: 'receive' }),
      sendTx({ id: 'd', token: ' ' }),
      sendTx({ id: 'e' })
    ]
    expect(
      selectSendTokensToCheck(transactions, ['e']).map((tx) => tx.id)
    ).toStrictEqual(['a'])
  })
})

describe('refreshSendTokenStatuses', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('records a changed status and keeps going after a failing mint', async () => {
    jest
      .mocked(validateEcashToken)
      .mockRejectedValueOnce(new Error('mint down'))
      .mockResolvedValueOnce({ isSpent: true, isValid: true })
    const updateTokenStatus = jest.fn()
    const stopChecking = jest.fn()

    const run = refreshSendTokenStatuses(
      [sendTx({ id: 'a' }), sendTx({ id: 'b', tokenStatus: 'unspent' })],
      {
        accountId: 'acc',
        isChecking: () => false,
        options: {},
        startChecking: jest.fn(),
        stopChecking,
        updateTokenStatus
      }
    )
    await jest.runAllTimersAsync()
    await run

    expect(stopChecking).toHaveBeenCalledTimes(2)
    expect(updateTokenStatus).toHaveBeenCalledWith('b', 'spent')
    expect(updateTokenStatus).toHaveBeenCalledTimes(1)
  })
})
