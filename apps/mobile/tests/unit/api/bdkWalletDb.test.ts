import * as FileSystem from 'expo-file-system/legacy'
import { BdkWallet, Network } from 'react-native-bdk-sdk'

import { getWalletFromDescriptor } from '@/api/bdk'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    deleteAsync: jest.fn(),
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn()
  })
)

jest.mock<typeof import('react-native-bdk-sdk')>(
  'react-native-bdk-sdk',
  () => ({
    ...jest.requireActual<typeof import('react-native-bdk-sdk')>(
      'react-native-bdk-sdk'
    ),
    BdkWallet: jest.fn()
  })
)

const mockGetInfo = jest.mocked(FileSystem.getInfoAsync)
const MockBdkWallet = jest.mocked(BdkWallet)

const DESCRIPTOR = 'wpkh([00000000/84h/1h/0h]tpubD6NzVbkrYhZ4X/0/*)'
const WALLETS_PATH = '/doc/wallets/'
const LEGACY_PATH = `${WALLETS_PATH}mock-wallet-name.sqlite`
const SIGNET_PATH = `${WALLETS_PATH}mock-wallet-name-signet.sqlite`
const TESTNET_PATH = `${WALLETS_PATH}mock-wallet-name-testnet.sqlite`

function mockExistingFiles(paths: string[]) {
  mockGetInfo.mockImplementation((uri) =>
    Promise.resolve({
      exists: paths.some((path) => uri === `file://${path}`),
      isDirectory: false,
      uri
    })
  )
}

describe('getWalletFromDescriptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates the database in a file named after the network', async () => {
    mockExistingFiles([WALLETS_PATH])

    const { dbPath } = await getWalletFromDescriptor(
      DESCRIPTOR,
      undefined,
      Network.Testnet
    )

    expect(dbPath).toBe(TESTNET_PATH)
  })

  it('keeps using a legacy database created for the same network', async () => {
    mockExistingFiles([WALLETS_PATH, LEGACY_PATH])

    const { dbPath } = await getWalletFromDescriptor(
      DESCRIPTOR,
      undefined,
      Network.Signet
    )

    expect(dbPath).toBe(LEGACY_PATH)
    expect(MockBdkWallet).toHaveBeenCalledTimes(1)
  })

  it('creates a new database when the legacy one is for another network', async () => {
    mockExistingFiles([WALLETS_PATH, LEGACY_PATH])
    MockBdkWallet.mockImplementationOnce(() => {
      throw new Error('Loaded wallet network mismatch')
    })

    const { dbPath } = await getWalletFromDescriptor(
      DESCRIPTOR,
      undefined,
      Network.Testnet
    )

    expect(dbPath).toBe(TESTNET_PATH)
    expect(MockBdkWallet).toHaveBeenLastCalledWith(
      DESCRIPTOR,
      undefined,
      Network.Testnet,
      TESTNET_PATH
    )
  })

  it('prefers the network database over the legacy one', async () => {
    mockExistingFiles([WALLETS_PATH, LEGACY_PATH, SIGNET_PATH])

    const { dbPath } = await getWalletFromDescriptor(
      DESCRIPTOR,
      undefined,
      Network.Signet
    )

    expect(dbPath).toBe(SIGNET_PATH)
    expect(MockBdkWallet).toHaveBeenCalledTimes(1)
  })
})
