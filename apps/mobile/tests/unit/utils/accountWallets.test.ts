import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { deleteWalletDb, getWalletData } from '@/api/bdk'
import { openServerChainReader } from '@/api/serverChain'
import { useWalletsStore } from '@/store/wallets'
import type { Account } from '@/types/models/Account'
import { type Server } from '@/types/settings/blockchain'
import {
  loadAccountWallets,
  walletForServerChain
} from '@/utils/accountWallets'

jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  ...jest.requireActual<typeof import('@/api/bdk')>('@/api/bdk'),
  deleteWalletDb: jest.fn(() => Promise.resolve()),
  getWalletData: jest.fn()
}))

jest.mock<typeof import('@/api/serverChain')>('@/api/serverChain', () => ({
  openServerChainReader: jest.fn()
}))

jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

jest.mock<typeof import('@/utils/decryption')>('@/utils/decryption', () => ({
  ...jest.requireActual<typeof import('@/utils/decryption')>(
    '@/utils/decryption'
  ),
  decryptAccountKeySecrets: jest.fn(() =>
    Promise.resolve([{ mnemonic: 'abandon abandon about' }])
  ),
  getAccountWithDecryptedKeys: jest.fn((account: Account) =>
    Promise.resolve(account)
  )
}))

const mockAccounts: { current: Account[] } = { current: [] }
const mockUpdateAccount = jest.fn()

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({
      accounts: mockAccounts.current,
      updateAccount: mockUpdateAccount
    })
  } as unknown as typeof import('@/store/accounts').useAccountsStore
}))

function makeAccount(id: string): Account {
  return {
    addresses: [],
    createdAt: new Date('2026-01-01'),
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
      lastUpdated: new Date('2026-01-01'),
      relays: [],
      syncStart: new Date('2026-01-01'),
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
    syncStatus: 'unsynced',
    transactions: [],
    utxos: []
  }
}

function makeWallet() {
  return new BdkWallet('', undefined, Network.Signet, '')
}

describe('loadAccountWallets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useWalletsStore.getState().deleteWallets()
    jest.mocked(getWalletData).mockResolvedValue({
      dbPath: 'wallet.sqlite',
      derivationPath: '',
      externalDescriptor: '',
      fingerprint: '',
      internalDescriptor: '',
      isNewDatabase: false,
      wallet: makeWallet()
    })
  })

  function makeAccountWithHistory(id: string): Account {
    return {
      ...makeAccount(id),
      transactions: [
        {
          id: 'tx-1',
          label: '',
          lockTimeEnabled: false,
          prices: {},
          received: 0,
          sent: 0,
          type: 'send'
        }
      ]
    }
  }

  it('drops the history a new wallet database does not hold', async () => {
    mockAccounts.current = [makeAccountWithHistory('acc-1')]
    jest.mocked(getWalletData).mockResolvedValueOnce({
      dbPath: 'wallet.sqlite',
      derivationPath: '',
      externalDescriptor: '',
      fingerprint: '',
      internalDescriptor: '',
      isNewDatabase: true,
      wallet: makeWallet()
    })

    await loadAccountWallets()

    expect(mockUpdateAccount).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'acc-1', transactions: [] })
    )
  })

  it('keeps the history of a wallet database that already existed', async () => {
    mockAccounts.current = [makeAccountWithHistory('acc-1')]

    await loadAccountWallets()

    expect(mockUpdateAccount).not.toHaveBeenCalled()
  })

  it('keeps a wallet that is already loaded', async () => {
    mockAccounts.current = [makeAccount('acc-1')]
    const loaded = makeWallet()
    useWalletsStore.getState().addAccountWallet('acc-1', loaded)

    await loadAccountWallets()

    expect(getWalletData).not.toHaveBeenCalled()
    expect(useWalletsStore.getState().wallets['acc-1']).toBe(loaded)
  })

  it('loads the wallets a restore removed for the same account ids', async () => {
    mockAccounts.current = [makeAccount('acc-1'), makeAccount('acc-2')]
    const { addAccountWallet, deleteWallets } = useWalletsStore.getState()
    addAccountWallet('acc-1', makeWallet())
    addAccountWallet('acc-2', makeWallet())
    deleteWallets()

    await loadAccountWallets()

    expect(getWalletData).toHaveBeenCalledTimes(2)
    const { wallets } = useWalletsStore.getState()
    expect(wallets['acc-1']).toBeDefined()
    expect(wallets['acc-2']).toBeDefined()
  })
})

describe('walletForServerChain', () => {
  const DB_PATH = 'acc-1-signet.sqlite'
  const SIGNET_TIP = 280_000
  const SIGNET_HASH = 'a'.repeat(64)
  const MUTINYNET_BLOCK = { hash: 'b'.repeat(64), height: 3_120_000 }
  const MEMPOOL_SERVER: Server = {
    backend: 'electrum',
    name: 'Mempool',
    network: 'signet',
    url: 'ssl://mempool.space:60602'
  }
  const MUTINYNET_SERVER: Server = {
    backend: 'esplora',
    name: 'Mutinynet',
    network: 'signet',
    url: 'https://mutinynet.com/api'
  }

  function readerFor(tipHeight: number, blockHash: string) {
    return {
      blockHash: jest.fn(() => Promise.resolve(blockHash)),
      close: jest.fn(),
      tipHeight: jest.fn(() => Promise.resolve(tipHeight))
    }
  }

  function walletWithBlock(block: { hash: string; height: number }) {
    const wallet = makeWallet()
    jest.mocked(wallet.checkpoints).mockReturnValue([block])
    return wallet
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useWalletsStore.getState().deleteWallets()
  })

  it('keeps a wallet that is on the server chain', async () => {
    const wallet = walletWithBlock({ hash: SIGNET_HASH, height: SIGNET_TIP })
    const reader = readerFor(SIGNET_TIP, SIGNET_HASH)
    jest.mocked(openServerChainReader).mockResolvedValue(reader)

    await expect(
      walletForServerChain(makeAccount('acc-1'), wallet, MEMPOOL_SERVER)
    ).resolves.toBe(wallet)
    expect(deleteWalletDb).not.toHaveBeenCalled()
    expect(reader.close).toHaveBeenCalledTimes(1)
  })

  it('replaces a wallet that holds another chain', async () => {
    const otherChainAccount = makeAccount('acc-2')
    const account = {
      ...otherChainAccount,
      summary: { ...otherChainAccount.summary, balance: 2_045_040 }
    }
    mockAccounts.current = [account]
    const wallet = walletWithBlock(MUTINYNET_BLOCK)
    const fresh = makeWallet()
    useWalletsStore.getState().addAccountWallet(account.id, wallet, DB_PATH)
    jest
      .mocked(openServerChainReader)
      .mockResolvedValue(readerFor(SIGNET_TIP, SIGNET_HASH))
    jest.mocked(getWalletData).mockResolvedValue({
      dbPath: DB_PATH,
      derivationPath: '',
      externalDescriptor: '',
      fingerprint: '',
      internalDescriptor: '',
      wallet: fresh
    })

    await expect(
      walletForServerChain(account, wallet, MEMPOOL_SERVER)
    ).resolves.toBe(fresh)
    expect(deleteWalletDb).toHaveBeenCalledWith(DB_PATH)
    expect(useWalletsStore.getState().wallets[account.id]).toBe(fresh)
    // A failed rescan must leave nothing that makes the next sync partial.
    expect(mockUpdateAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        addresses: [],
        id: account.id,
        summary: expect.objectContaining({ balance: 0 }),
        transactions: [],
        utxos: []
      })
    )
  })

  it('checks a wallet once per server', async () => {
    const account = makeAccount('acc-3')
    const wallet = walletWithBlock({ hash: SIGNET_HASH, height: SIGNET_TIP })
    jest
      .mocked(openServerChainReader)
      .mockResolvedValue(readerFor(SIGNET_TIP, SIGNET_HASH))

    await walletForServerChain(account, wallet, MEMPOOL_SERVER)
    await walletForServerChain(account, wallet, MEMPOOL_SERVER)
    expect(openServerChainReader).toHaveBeenCalledTimes(1)

    await walletForServerChain(account, wallet, MUTINYNET_SERVER)
    expect(openServerChainReader).toHaveBeenCalledTimes(2)
  })

  it('keeps the wallet when the server cannot be checked', async () => {
    const wallet = walletWithBlock(MUTINYNET_BLOCK)
    jest
      .mocked(openServerChainReader)
      .mockRejectedValue(new Error('unreachable'))

    await expect(
      walletForServerChain(makeAccount('acc-4'), wallet, MEMPOOL_SERVER)
    ).resolves.toBe(wallet)
    expect(deleteWalletDb).not.toHaveBeenCalled()
  })

  it('leaves the wallet alone when the sync was given up during the check', async () => {
    const account = makeAccount('acc-6')
    const wallet = walletWithBlock(MUTINYNET_BLOCK)
    useWalletsStore.getState().addAccountWallet(account.id, wallet, DB_PATH)
    const controller = new AbortController()
    jest.mocked(openServerChainReader).mockImplementation(() => {
      controller.abort()
      return Promise.resolve(readerFor(SIGNET_TIP, SIGNET_HASH))
    })

    await expect(
      walletForServerChain(account, wallet, MEMPOOL_SERVER, controller.signal)
    ).resolves.toBe(wallet)
    expect(deleteWalletDb).not.toHaveBeenCalled()
    expect(useWalletsStore.getState().wallets[account.id]).toBe(wallet)
  })

  it('refuses to reset a wallet whose database is unknown', async () => {
    const wallet = walletWithBlock(MUTINYNET_BLOCK)
    jest
      .mocked(openServerChainReader)
      .mockResolvedValue(readerFor(SIGNET_TIP, SIGNET_HASH))

    await expect(
      walletForServerChain(makeAccount('acc-5'), wallet, MEMPOOL_SERVER)
    ).rejects.toThrow('Rescan Wallet')
    expect(deleteWalletDb).not.toHaveBeenCalled()
  })
})
