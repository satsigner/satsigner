import { createElement } from 'react'
import { BdkWallet, Network } from 'react-native-bdk-sdk'
import { act, create } from 'react-test-renderer'

import { syncWithCoreWallet } from '@/api/coreWalletSync'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { cancelAllAccountSyncs } from '@/utils/accountSyncRuns'

jest.mock<typeof import('@/api/coreWalletSync')>(
  '@/api/coreWalletSync',
  () => ({ syncWithCoreWallet: jest.fn() })
)

jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  syncWallet: jest.fn()
}))

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
      configs: {},
      lastKnownBlockHeight: 0,
      selectedNetwork: 'signet',
      setLastKnownBlockHeight: jest.fn()
    }))
  }
})

const NODE_URL = 'http://node:8332'
const OTHER_NODE_URL = 'http://other:8332'

function makeAccount(id: string): Account {
  return {
    addresses: [],
    createdAt: new Date(0),
    id,
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
    name: id,
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
      numberOfAddresses: 0,
      numberOfTransactions: 0,
      numberOfUtxos: 0,
      satsInMempool: 0
    },
    syncStatus: 'synced',
    transactions: [],
    utxos: []
  }
}

function setServer(url: string, connectionMode: 'auto' | 'manual') {
  useBlockchainStore.setState({
    configs: {
      signet: {
        config: { connectionMode, stopGap: 20 },
        server: {
          backend: 'rpc',
          name: 'node',
          network: 'signet',
          rpcCredentials: { password: 'pass', username: 'user' },
          url
        }
      }
    },
    lastKnownBlockHeight: 100
  })
}

const CORE_RESULT = {
  addresses: [],
  rpcLastBlockHash: 'tip',
  summary: makeAccount('summary').summary,
  transactions: [],
  utxos: []
}

function holdFirstCoreSync() {
  const gate: { release?: () => void } = {}
  jest.mocked(syncWithCoreWallet).mockReturnValueOnce(
    new Promise((resolve) => {
      gate.release = () => resolve(CORE_RESULT)
    })
  )
  jest.mocked(syncWithCoreWallet).mockResolvedValue(CORE_RESULT)
  return gate
}

type WalletSync = ReturnType<typeof useSyncAccountWithWallet>

function renderWalletSync() {
  const result: { current: WalletSync | null } = { current: null }
  function Harness() {
    result.current = useSyncAccountWithWallet()
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

const reportError = jest.fn()

function syncAccount(
  hook: { current: WalletSync | null },
  accountId: string,
  isPriority = false
) {
  const account = makeAccount(accountId)
  const wallet = new BdkWallet('', undefined, Network.Signet, '')
  return hook.current?.syncAccountWithWallet(
    account,
    wallet,
    false,
    isPriority,
    reportError
  )
}

function coreSyncedAccountIds() {
  return jest
    .mocked(syncWithCoreWallet)
    .mock.calls.map(([account]) => account.id)
}

async function flushPromises() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

describe('useSyncAccountWithWallet on a Bitcoin Core node', () => {
  beforeEach(() => {
    cancelAllAccountSyncs()
    jest.mocked(syncWithCoreWallet).mockReset()
    reportError.mockClear()
    useAccountsStore.setState({
      accounts: [makeAccount('a'), makeAccount('b')]
    })
    setServer(NODE_URL, 'auto')
  })

  it('skips a sync whose server changed while it waited for the node', async () => {
    const gate = holdFirstCoreSync()
    const hook = renderWalletSync()

    const first = syncAccount(hook, 'a')
    const second = syncAccount(hook, 'b')
    await flushPromises()
    setServer(OTHER_NODE_URL, 'auto')
    gate.release?.()

    await expect(first).resolves.toMatchObject({ syncStatus: 'synced' })
    await expect(second).resolves.toBeNull()
    expect(coreSyncedAccountIds()).toStrictEqual(['a'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('skips a background sync when manual mode is turned on while it waits', async () => {
    const gate = holdFirstCoreSync()
    const hook = renderWalletSync()

    const first = syncAccount(hook, 'a')
    const second = syncAccount(hook, 'b')
    await flushPromises()
    setServer(NODE_URL, 'manual')
    gate.release?.()

    await first
    await expect(second).resolves.toBeNull()
    expect(coreSyncedAccountIds()).toStrictEqual(['a'])
    expect(reportError).not.toHaveBeenCalled()
  })

  it('still runs a waiting sync the user asked for after manual mode was turned on', async () => {
    const gate = holdFirstCoreSync()
    const hook = renderWalletSync()

    const first = syncAccount(hook, 'a')
    const second = syncAccount(hook, 'b')
    await flushPromises()
    setServer(NODE_URL, 'manual')
    const requested = syncAccount(hook, 'b', true)
    gate.release?.()

    await first
    await expect(second).resolves.toMatchObject({ syncStatus: 'synced' })
    await expect(requested).resolves.toBeNull()
    expect(coreSyncedAccountIds()).toStrictEqual(['a', 'b'])
    expect(reportError).not.toHaveBeenCalled()
  })
})
