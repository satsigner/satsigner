// api/bdk pulls in electrum-client → react-native-tcp-socket, which has no
// jest-safe native binding; the module is mocked wholesale so the creation
// logic is exercised without native BDK.
jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  getWalletData: jest.fn(),
  getWalletOverview: jest.fn(),
  syncWallet: jest.fn()
}))

import { getWalletData, getWalletOverview, syncWallet } from '@/api/bdk'
import {
  CLOWN_ACCOUNT_NAME,
  clownSignetWalletSeed,
  SAMPLE_SEGWIT_ACCOUNT_NAME,
  sampleSignetWalletSeed,
  sampleSignetXpubFingerprint
} from '@/constants/samples'
import { useAccountsStore } from '@/store/accounts'
import { AccountSchema, type Account } from '@/types/models/Account'
import {
  buildSeedAccount,
  ensureRoundtripAccounts
} from '@/utils/payjoinLiveRoundtripCreate'

const mockGetWalletData = jest.mocked(getWalletData)
const mockGetWalletOverview = jest.mocked(getWalletOverview)
const mockSyncWallet = jest.mocked(syncWallet)

function stubAccount(overrides: Partial<Account>): Account {
  return {
    id: 'existing',
    keyCount: 1,
    keys: [
      {
        creationType: 'importMnemonic',
        fingerprint: sampleSignetXpubFingerprint,
        index: 0,
        iv: '',
        secret: ''
      }
    ],
    keysRequired: 1,
    name: 'Account',
    network: 'signet',
    policyType: 'singlesig',
    ...overrides
  } as Account
}

describe('payjoinLiveRoundtripCreate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAccountsStore.setState({ accounts: [] })
    mockGetWalletData.mockResolvedValue({
      dbPath: '/tmp/wallet.sqlite',
      derivationPath: "m/84'/1'/0'",
      fingerprint: 'aabbccdd',
      wallet: {}
    })
    mockGetWalletOverview.mockReturnValue({
      addresses: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0
      },
      transactions: [],
      utxos: []
    })
    mockSyncWallet.mockResolvedValue(undefined)
  })

  describe('buildSeedAccount', () => {
    it('builds a schema-valid singlesig P2WPKH signet account for Sample', () => {
      const account = buildSeedAccount(
        SAMPLE_SEGWIT_ACCOUNT_NAME,
        sampleSignetWalletSeed
      )

      expect(() => AccountSchema.parse(account)).not.toThrow()
      expect(account.name).toBe(SAMPLE_SEGWIT_ACCOUNT_NAME)
      expect(account.network).toBe('signet')
      expect(account.policyType).toBe('singlesig')
      expect(account.keys).toHaveLength(1)
      // The finder's fingerprint fallback must match the derived master
      // fingerprint (network/script independent).
      expect(account.keys[0].fingerprint).toBe(sampleSignetXpubFingerprint)
      expect(account.keys[0].mnemonicWordCount).toBe(12)
      expect(account.keys[0].scriptVersion).toBe('P2WPKH')
    })

    it('handles the 24-word Clown seed', () => {
      const account = buildSeedAccount(
        CLOWN_ACCOUNT_NAME,
        clownSignetWalletSeed
      )

      expect(() => AccountSchema.parse(account)).not.toThrow()
      expect(account.keys[0].mnemonicWordCount).toBe(24)
    })
  })

  describe('ensureRoundtripAccounts', () => {
    it('reuses existing Sample and Clown accounts without creating anything', async () => {
      const sample = stubAccount({
        id: 'sample',
        name: SAMPLE_SEGWIT_ACCOUNT_NAME
      })
      const clown = stubAccount({ id: 'clown', name: CLOWN_ACCOUNT_NAME })
      useAccountsStore.setState({ accounts: [sample, clown] })

      const { sender, receiver } = await ensureRoundtripAccounts()

      expect(sender).toBe(sample)
      expect(receiver).toBe(clown)
      expect(mockGetWalletData).not.toHaveBeenCalled()
      expect(mockSyncWallet).not.toHaveBeenCalled()
    })

    it('creates and full-scans both accounts when missing', async () => {
      const steps: string[] = []
      const { sender, receiver } = await ensureRoundtripAccounts((message) =>
        steps.push(message)
      )

      expect(sender.name).toBe(SAMPLE_SEGWIT_ACCOUNT_NAME)
      expect(receiver.name).toBe(CLOWN_ACCOUNT_NAME)
      expect(sender.syncStatus).toBe('synced')
      expect(receiver.syncStatus).toBe('synced')
      expect(mockGetWalletData).toHaveBeenCalledTimes(2)
      // Full scan (5th arg) so pre-existing funds on the known seeds are found.
      expect(mockSyncWallet).toHaveBeenCalledTimes(2)
      expect(mockSyncWallet.mock.calls[0][4]).toBe(true)
      expect(steps).toHaveLength(2)
      expect(
        useAccountsStore.getState().accounts.map((a) => a.name)
      ).toStrictEqual([SAMPLE_SEGWIT_ACCOUNT_NAME, CLOWN_ACCOUNT_NAME])
    })

    it('creates only the missing account', async () => {
      const sample = stubAccount({
        id: 'sample',
        name: SAMPLE_SEGWIT_ACCOUNT_NAME
      })
      useAccountsStore.setState({ accounts: [sample] })

      const { sender, receiver } = await ensureRoundtripAccounts()

      expect(sender).toBe(sample)
      expect(receiver.name).toBe(CLOWN_ACCOUNT_NAME)
      expect(mockGetWalletData).toHaveBeenCalledTimes(1)
      expect(mockSyncWallet).toHaveBeenCalledTimes(1)
    })
  })
})
