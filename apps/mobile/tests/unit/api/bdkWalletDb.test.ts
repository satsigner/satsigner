import * as FileSystem from 'expo-file-system/legacy'
import {
  BdkWallet,
  Network,
  walletNameFromDescriptor
} from 'react-native-bdk-sdk'

import { getWalletFromDescriptor } from '@/api/bdk'

jest.mock<typeof import('expo-file-system/legacy')>(
  'expo-file-system/legacy',
  () => ({
    ...jest.requireActual<typeof import('expo-file-system/legacy')>(
      'expo-file-system/legacy'
    ),
    deleteAsync: jest.fn(),
    documentDirectory: 'file:///doc/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn()
  })
)

jest.mock<typeof import('react-native-bdk-sdk')>('react-native-bdk-sdk', () => {
  const actual = jest.requireActual<typeof import('react-native-bdk-sdk')>(
    'react-native-bdk-sdk'
  )
  return {
    ...actual,
    BdkWallet: Object.assign(jest.fn(), {
      fromMultipath: actual.BdkWallet.fromMultipath,
      fromRaw: actual.BdkWallet.fromRaw,
      prototype: actual.BdkWallet.prototype
    })
  }
})

const mockGetInfo = jest.mocked(FileSystem.getInfoAsync)
const MockBdkWallet = jest.mocked(BdkWallet)

const DESCRIPTOR = 'wpkh([00000000/84h/1h/0h]tpubD6NzVbkrYhZ4X/0/*)'
const CHANGE_DESCRIPTOR = 'wpkh([00000000/84h/1h/0h]tpubD6NzVbkrYhZ4X/1/*)'
const WALLETS_PATH = '/doc/wallets/'
const RECEIVE_ONLY_NAME = 'named-receive-only'
const WITH_CHANGE_NAME = 'named-with-change'
const LEGACY_PATH = `${WALLETS_PATH}${RECEIVE_ONLY_NAME}.sqlite`
const SIGNET_PATH = `${WALLETS_PATH}${WITH_CHANGE_NAME}-signet.sqlite`
const TESTNET_PATH = `${WALLETS_PATH}${WITH_CHANGE_NAME}-testnet.sqlite`

function fileInfo(uri: string, exists: boolean): FileSystem.FileInfo {
  if (!exists) {
    return { exists: false, isDirectory: false, uri }
  }
  return {
    exists: true,
    isDirectory: false,
    modificationTime: 0,
    size: 0,
    uri
  }
}

function mockExistingFiles(paths: string[]) {
  mockGetInfo.mockImplementation((uri) =>
    Promise.resolve(
      fileInfo(
        uri,
        paths.some((path) => uri === `file://${path}`)
      )
    )
  )
}

describe('getWalletFromDescriptor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(walletNameFromDescriptor)
      .mockImplementation((_ext, change) =>
        change ? WITH_CHANGE_NAME : RECEIVE_ONLY_NAME
      )
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
    expect(walletNameFromDescriptor).toHaveBeenCalledWith(
      DESCRIPTOR,
      undefined,
      Network.Signet
    )
    expect(MockBdkWallet).toHaveBeenCalledTimes(1)
  })

  it('rethrows a legacy database error that is not a network mismatch', async () => {
    mockExistingFiles([WALLETS_PATH, LEGACY_PATH])
    MockBdkWallet.mockImplementationOnce(() => {
      throw new Error('database is locked')
    })

    await expect(
      getWalletFromDescriptor(DESCRIPTOR, undefined, Network.Signet)
    ).rejects.toThrow('database is locked')
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
      CHANGE_DESCRIPTOR,
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

  it('derives the change descriptor when only the receive one is given', async () => {
    mockExistingFiles([WALLETS_PATH])

    await getWalletFromDescriptor(`${DESCRIPTOR}#abcdefgh`, '', Network.Signet)

    expect(MockBdkWallet).toHaveBeenCalledWith(
      DESCRIPTOR,
      CHANGE_DESCRIPTOR,
      Network.Signet,
      SIGNET_PATH
    )
  })

  it('keeps the given change descriptor', async () => {
    mockExistingFiles([WALLETS_PATH])
    const changeDescriptor = 'wpkh([00000000/84h/1h/0h]tpubD6NzVbkrYhZ4X/5/*)'

    await getWalletFromDescriptor(DESCRIPTOR, changeDescriptor, Network.Signet)

    expect(MockBdkWallet).toHaveBeenCalledWith(
      DESCRIPTOR,
      changeDescriptor,
      Network.Signet,
      SIGNET_PATH
    )
  })
})
