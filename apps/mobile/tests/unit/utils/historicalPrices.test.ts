import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { type Transaction } from '@/types/models/Transaction'
import { backfillHistoricalPrices } from '@/utils/historicalPrices'
import { resolveHistoricalPrices } from '@/utils/resolveHistoricalPrices'

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: jest.fn() }
}))

jest.mock<typeof import('@/utils/resolveHistoricalPrices')>(
  '@/utils/resolveHistoricalPrices',
  () => ({
    resolveHistoricalPrices: jest.fn(),
    resolvePricesAt: jest.fn()
  })
)

const resolveHistoricalPricesMock = jest.mocked(resolveHistoricalPrices)
const initialSettings = useSettingsStore.getState()
const initialPrices = usePriceStore.getState()

const JAN_1 = new Date('2024-01-01T00:00:00Z')
const JAN_1_SECONDS = 1_704_067_200
const JAN_2_ISO = '2024-01-02T00:00:00.000Z'
const JAN_2_SECONDS = 1_704_153_600

function makeTx(
  overrides: Partial<Transaction> & Pick<Transaction, 'id'>
): Transaction {
  return {
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: [],
    ...overrides
  }
}

function persistedTx(id: string, timestamp: string) {
  return { ...makeTx({ id }), timestamp }
}

function mockAccounts(accounts: { id: string; transactions: unknown[] }[]) {
  const updateAccount = jest.fn()
  jest
    .mocked(useAccountsStore.getState)
    .mockReturnValue({ accounts, updateAccount })
  return updateAccount
}

describe('backfillHistoricalPrices', () => {
  beforeEach(() => {
    useSettingsStore.setState({ fetchHistoricalPrices: true })
    usePriceStore.setState({ fiatCurrency: 'USD' })
  })

  afterEach(() => {
    useSettingsStore.setState(initialSettings, true)
    usePriceStore.setState(initialPrices, true)
    jest.resetAllMocks()
  })

  it('does nothing when historical prices are off', async () => {
    useSettingsStore.setState({ fetchHistoricalPrices: false })
    const updateAccount = mockAccounts([
      { id: 'acc', transactions: [makeTx({ id: 'a', timestamp: JAN_1 })] }
    ])

    await backfillHistoricalPrices()

    expect(resolveHistoricalPricesMock).not.toHaveBeenCalled()
    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('prices only dated transactions that have no saved price', async () => {
    const dated = makeTx({ id: 'a', timestamp: JAN_1 })
    const persisted = persistedTx('b', JAN_2_ISO)
    const unconfirmed = makeTx({ id: 'c' })
    const invalid = persistedTx('d', 'not a date')
    const priced = makeTx({ id: 'e', prices: { USD: 5 }, timestamp: JAN_1 })
    const updateAccount = mockAccounts([
      {
        id: 'acc',
        transactions: [dated, persisted, unconfirmed, invalid, priced]
      },
      { id: 'done', transactions: [priced] }
    ])
    resolveHistoricalPricesMock.mockResolvedValue({
      [JAN_1_SECONDS]: 100,
      [JAN_2_SECONDS]: 200
    })

    await backfillHistoricalPrices()

    expect(resolveHistoricalPricesMock).toHaveBeenCalledWith('USD', [
      JAN_1_SECONDS,
      JAN_2_SECONDS
    ])
    expect(updateAccount).toHaveBeenCalledTimes(1)
    const [[updated]] = updateAccount.mock.calls
    expect(updated.id).toBe('acc')
    expect(updated.transactions[0]).toMatchObject({
      id: 'a',
      prices: { USD: 100 }
    })
    expect(updated.transactions[1].prices).toStrictEqual({ USD: 200 })
    expect(updated.transactions[1].timestamp).toStrictEqual(new Date(JAN_2_ISO))
    expect(updated.transactions[2]).toBe(unconfirmed)
    expect(updated.transactions[3]).toBe(invalid)
    expect(updated.transactions[4]).toBe(priced)
  })

  it('leaves accounts untouched when no price resolves', async () => {
    const updateAccount = mockAccounts([
      { id: 'acc', transactions: [makeTx({ id: 'a', timestamp: JAN_1 })] }
    ])
    resolveHistoricalPricesMock.mockResolvedValue({})

    await backfillHistoricalPrices()

    expect(updateAccount).not.toHaveBeenCalled()
  })

  it('skips the lookup when every transaction is priced or undated', async () => {
    const updateAccount = mockAccounts([
      {
        id: 'acc',
        transactions: [
          makeTx({ id: 'a', prices: { USD: 1 }, timestamp: JAN_1 }),
          makeTx({ id: 'b' })
        ]
      }
    ])

    await backfillHistoricalPrices()

    expect(resolveHistoricalPricesMock).not.toHaveBeenCalled()
    expect(updateAccount).not.toHaveBeenCalled()
  })
})
