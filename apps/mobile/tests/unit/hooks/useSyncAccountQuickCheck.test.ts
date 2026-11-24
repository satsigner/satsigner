import { createElement } from 'react'
import { BdkWallet, Network } from 'react-native-bdk-sdk'
import { act, create } from 'react-test-renderer'

import { readAddressActivity } from '@/api/addressActivity'
import { syncWallet } from '@/api/bdk'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'
import type { Address } from '@/types/models/Address'
import { cancelAllAccountSyncs } from '@/utils/accountSyncRuns'

jest.mock<typeof import('@/api/addressActivity')>(
  '@/api/addressActivity',
  () => ({ readAddressActivity: jest.fn() })
)

jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  syncWallet: jest.fn(() => Promise.resolve())
}))

jest.mock<typeof import('@/utils/accountWallets')>(
  '@/utils/accountWallets',
  () => ({
    loadAccountWallets: jest.fn(),
    walletForServerChain: jest.fn((_account, wallet) => Promise.resolve(wallet))
  })
)

jest.mock<typeof import('sonner-native')>('sonner-native', () => ({
  toast: { error: jest.fn() }
}))

jest.mock<typeof import('@/store/price')>('@/store/price', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return { usePriceStore: createStore(() => ({ fiatCurrency: 'USD' })) }
})

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{
      accounts: Account[]
      setSyncProgress: jest.Mock
      setSyncStatus: (id: string, syncStatus: Account['syncStatus']) => void
    }>((set) => ({
      accounts: [],
      setSyncProgress: jest.fn(),
      setSyncStatus: (id, syncStatus) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? { ...account, syncStatus } : account
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
          config: { connectionMode: 'auto', stopGap: 2 },
          server: {
            backend: 'electrum',
            name: 'electrum',
            network: 'signet',
            url: 'ssl://electrum.example.com:50002'
          }
        }
      },
      lastKnownBlockHeight: 100,
      selectedNetwork: 'signet',
      setLastKnownBlockHeight: jest.fn()
    }))
  }
})

const SYNCED_AT = new Date(Date.now() - 60 * 60_000)

function makeAddress(index: number, transactions: string[] = []): Address {
  return {
    address: `external-${index}`,
    index,
    keychain: 'external',
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions,
    utxos: []
  }
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    addresses: [makeAddress(0, ['a']), makeAddress(1), makeAddress(2)],
    createdAt: new Date(0),
    displayIndex: 0,
    id: 'acc',
    keyCount: 1,
    keys: [
      {
        creationType: 'importMnemonic',
        index: 0,
        iv: 'iv',
        scriptVersion: 'P2WPKH',
        secret: 'encrypted'
      }
    ],
    keysRequired: 1,
    labels: {},
    lastFullCheckAt: SYNCED_AT,
    lastSyncedAt: SYNCED_AT,
    name: 'acc',
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
    policyType: 'singlesig',
    summary: {
      balance: 0,
      numberOfAddresses: 3,
      numberOfTransactions: 1,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [
      {
        blockHeight: 90,
        id: 'a',
        lockTimeEnabled: false,
        prices: {},
        received: 1000,
        sent: 0,
        type: 'receive',
        vin: [],
        vout: []
      }
    ],
    utxos: [],
    ...overrides
  }
}

const UNCHANGED = [
  { address: 'external-1', confirmedCount: 0, unconfirmedTxids: [] },
  { address: 'external-2', confirmedCount: 0, unconfirmedTxids: [] }
]

function renderWalletSync() {
  const result: {
    current: ReturnType<typeof useSyncAccountWithWallet> | null
  } = { current: null }
  function Harness() {
    result.current = useSyncAccountWithWallet()
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

const wallet = new BdkWallet('', undefined, Network.Signet, '')

describe('useSyncAccountWithWallet quick check', () => {
  beforeEach(() => {
    cancelAllAccountSyncs()
    jest.mocked(readAddressActivity).mockReset()
    jest.mocked(syncWallet).mockClear()
  })

  it('skips the full sync when nothing changed', async () => {
    const account = makeAccount()
    useAccountsStore.setState({ accounts: [account] })
    jest.mocked(readAddressActivity).mockResolvedValue(UNCHANGED)
    const hook = renderWalletSync()

    const result = await hook.current?.syncAccountWithWallet(account, wallet)

    expect(readAddressActivity).toHaveBeenCalledWith(
      expect.objectContaining({ backend: 'electrum' }),
      ['external-1', 'external-2'],
      expect.anything()
    )
    expect(syncWallet).not.toHaveBeenCalled()
    expect(result?.syncStatus).toBe('synced')
    expect(result?.lastSyncedAt?.getTime()).toBeGreaterThan(SYNCED_AT.getTime())
    expect(result?.lastFullCheckAt).toStrictEqual(SYNCED_AT)
  })

  it('syncs when the quick check finds a payment', async () => {
    const account = makeAccount()
    useAccountsStore.setState({ accounts: [account] })
    jest
      .mocked(readAddressActivity)
      .mockResolvedValue([
        { address: 'external-1', confirmedCount: 1, unconfirmedTxids: [] },
        UNCHANGED[1]
      ])
    const hook = renderWalletSync()

    const result = await hook.current?.syncAccountWithWallet(account, wallet)

    expect(syncWallet).toHaveBeenCalledTimes(1)
    expect(result?.lastFullCheckAt?.getTime()).toBeGreaterThan(
      SYNCED_AT.getTime()
    )
  })

  it('syncs when the quick check cannot reach the server', async () => {
    const account = makeAccount()
    useAccountsStore.setState({ accounts: [account] })
    jest.mocked(readAddressActivity).mockRejectedValue(new Error('offline'))
    const hook = renderWalletSync()

    await hook.current?.syncAccountWithWallet(account, wallet)

    expect(syncWallet).toHaveBeenCalledTimes(1)
  })

  it('checks every address when asked to', async () => {
    const account = makeAccount()
    useAccountsStore.setState({ accounts: [account] })
    const hook = renderWalletSync()

    await hook.current?.checkAllAccountAddresses(account, wallet)

    expect(readAddressActivity).not.toHaveBeenCalled()
    expect(syncWallet).toHaveBeenCalledTimes(1)
  })

  it('checks every address when there was no full check yet', async () => {
    const account = makeAccount({ lastFullCheckAt: undefined })
    useAccountsStore.setState({ accounts: [account] })
    const hook = renderWalletSync()

    await hook.current?.syncAccountWithWallet(account, wallet)

    expect(readAddressActivity).not.toHaveBeenCalled()
    expect(syncWallet).toHaveBeenCalledTimes(1)
  })

  it('gives a sync already running to a request that shares its result', async () => {
    const account = makeAccount()
    useAccountsStore.setState({ accounts: [account] })
    const gate: { release?: () => void } = {}
    jest.mocked(readAddressActivity).mockReturnValue(
      new Promise((resolve) => {
        gate.release = () => resolve(UNCHANGED)
      })
    )
    const hook = renderWalletSync()

    const background = hook.current?.syncAccountWithWallet(account, wallet)
    const shared = hook.current?.syncAccountNow(account, wallet)
    const duplicate = hook.current?.syncAccountWithWallet(account, wallet)
    gate.release?.()

    await expect(background).resolves.toMatchObject({ syncStatus: 'synced' })
    await expect(shared).resolves.toMatchObject({ syncStatus: 'synced' })
    await expect(duplicate).resolves.toBeNull()
    expect(readAddressActivity).toHaveBeenCalledTimes(1)
  })
})
