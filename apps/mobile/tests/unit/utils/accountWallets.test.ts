import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { getWalletData } from '@/api/bdk'
import { useWalletsStore } from '@/store/wallets'
import type { Account } from '@/types/models/Account'
import { loadAccountWallets } from '@/utils/accountWallets'

jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  ...jest.requireActual<typeof import('@/api/bdk')>('@/api/bdk'),
  getWalletData: jest.fn()
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
  )
}))

const mockAccounts: { current: Account[] } = { current: [] }

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: () => ({ accounts: mockAccounts.current })
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
      wallet: makeWallet()
    })
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
