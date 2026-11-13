import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { fetchAddressSnapshot } from '@/api/addressSync'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

const ADDRESS = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
const STORED_BALANCE = 5000

jest.mock<typeof import('@/api/addressSync')>('@/api/addressSync', () => ({
  fetchAddressSnapshot: jest.fn()
}))

jest.mock<typeof import('@/api/electrumReachability')>(
  '@/api/electrumReachability',
  () => ({
    ElectrumUnreachableError: class extends Error {},
    assertElectrumReachable: jest.fn(() => Promise.resolve()),
    clearElectrumReachabilityChecks: jest.fn()
  })
)

jest.mock<typeof import('@/utils/decryption')>('@/utils/decryption', () => ({
  ...jest.requireActual<typeof import('@/utils/decryption')>(
    '@/utils/decryption'
  ),
  decryptAccountKeySecrets: jest.fn(() =>
    Promise.resolve([
      { externalDescriptor: 'addr(tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx)' }
    ])
  )
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{
      accounts: Account[]
      setSyncProgress: jest.Mock
      setSyncStatus: (id: string, syncStatus: Account['syncStatus']) => void
      updateAccount: (account: Account) => void
    }>((set) => ({
      accounts: [],
      setSyncProgress: jest.fn(),
      setSyncStatus: (id, syncStatus) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? { ...account, syncStatus } : account
          )
        })),
      updateAccount: (updated) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === updated.id ? updated : account
          )
        }))
    }))
  }
})

jest.mock<typeof import('@/store/blockchain')>('@/store/blockchain', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useBlockchainStore: createStore(() => ({
      configs: {
        signet: {
          server: {
            backend: 'esplora',
            network: 'signet',
            url: 'https://esplora.test/api'
          }
        }
      },
      selectedNetwork: 'signet'
    }))
  }
})

jest.mock<typeof import('@/store/price')>('@/store/price', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return { usePriceStore: createStore(() => ({ fiatCurrency: 'USD' })) }
})

function makeAccount(): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    id: 'watch-address',
    keyCount: 1,
    keys: [
      {
        creationType: 'importAddress',
        index: 0,
        iv: 'iv',
        secret: 'encrypted'
      }
    ],
    keysRequired: 1,
    labels: {},
    name: 'Sample (watchonlyAddress)',
    network: 'signet',
    nostr: {
      autoSync: false,
      commonNpub: '',
      commonNsec: '',
      dms: [],
      lastUpdated: new Date(0),
      relays: [],
      syncStart: new Date(0),
      trustedMemberDevices: []
    },
    policyType: 'watchonly',
    summary: {
      balance: STORED_BALANCE,
      numberOfAddresses: 1,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }
}

type AddressSync = ReturnType<typeof useSyncAccountWithAddress>

function renderAddressSync() {
  const result: { current: AddressSync | null } = { current: null }
  function Harness() {
    result.current = useSyncAccountWithAddress()
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

function storedAccount() {
  return useAccountsStore.getState().accounts[0]
}

describe('useSyncAccountWithAddress', () => {
  const reportError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    useAccountsStore.setState({ accounts: [makeAccount()] })
  })

  it('keeps the balance when the sync fails', async () => {
    jest
      .mocked(fetchAddressSnapshot)
      .mockRejectedValue(new Error('unreachable'))
    const hook = renderAddressSync()

    const result = await hook.current?.syncAccountWithAddress(
      makeAccount(),
      reportError
    )

    expect(result?.syncStatus).toBe('error')
    expect(result?.summary.balance).toBe(STORED_BALANCE)
    expect(storedAccount().summary.balance).toBe(STORED_BALANCE)
    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('takes the balance from the server on success', async () => {
    jest.mocked(fetchAddressSnapshot).mockResolvedValue({
      balance: { confirmed: 7000, unconfirmed: 300 },
      transactions: [],
      txids: [],
      utxos: [{ txid: 'a'.repeat(64), value: 7000, vout: 0 }]
    })
    const hook = renderAddressSync()

    const result = await hook.current?.syncAccountWithAddress(
      makeAccount(),
      reportError
    )

    expect(result?.syncStatus).toBe('synced')
    expect(result?.summary.balance).toBe(7000)
    expect(result?.summary.satsInMempool).toBe(300)
    expect(storedAccount().summary.numberOfUtxos).toBe(1)
    expect(
      storedAccount().addresses.map((entry) => entry.address)
    ).toStrictEqual([ADDRESS])
  })
})
