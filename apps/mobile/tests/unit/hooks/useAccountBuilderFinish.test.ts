import { createElement } from 'react'
import { act, create } from 'react-test-renderer'

import { getWalletData } from '@/api/bdk'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import { storeKeySecret } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'

jest.mock<typeof import('@/api/bdk')>('@/api/bdk', () => ({
  getWalletData: jest.fn()
}))

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  storeKeySecret: jest.fn()
}))

jest.mock<typeof import('@/utils/pin')>('@/utils/pin', () => ({
  getPin: jest.fn(() => Promise.resolve('pin-digest'))
}))

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  ...jest.requireActual<typeof import('@/utils/crypto')>('@/utils/crypto'),
  aesEncrypt: jest.fn((text: string, key: string) =>
    Promise.resolve(`${key}|${text}`)
  )
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{
      accounts: Account[]
      addAccount: (account: Account) => void
    }>((set) => ({
      accounts: [],
      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, account] }))
    }))
  }
})

jest.mock<typeof import('@/store/wallets')>('@/store/wallets', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useWalletsStore: createStore(() => ({
      addAccountAddress: jest.fn(),
      addAccountWallet: jest.fn()
    }))
  }
})

const SECRET: Secret = { fingerprint: 'abcd1234', mnemonic: 'abandon' }

type BuilderFinish = ReturnType<typeof useAccountBuilderFinish>

function renderBuilderFinish() {
  const result: { current: BuilderFinish | null } = { current: null }
  function Harness() {
    result.current = useAccountBuilderFinish()
    return null
  }
  act(() => {
    create(createElement(Harness))
  })
  return result
}

async function finish(
  result: { current: BuilderFinish | null },
  account: Account
) {
  const outcome: {
    data?: Awaited<ReturnType<BuilderFinish['accountBuilderFinish']>>
  } = {}
  await act(async () => {
    outcome.data = await result.current?.accountBuilderFinish(account)
  })
  return outcome.data
}

function seedBuilder() {
  useAccountBuilderStore.setState({
    keyCount: 1,
    keys: [
      {
        creationType: 'importMnemonic',
        index: 0,
        iv: 'iv',
        scriptVersion: 'P2WPKH',
        secret: SECRET
      }
    ],
    keysRequired: 1,
    name: 'Savings',
    policyType: 'singlesig'
  })
}

describe('useAccountBuilderFinish', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAccountsStore.setState({ accounts: [] })
    jest.mocked(getWalletData).mockImplementation((account) => {
      const [key] = account.keys
      if (typeof key.secret === 'string') {
        return Promise.reject(new Error('Invalid secret'))
      }
      return Promise.resolve({
        dbPath: 'db',
        derivationPath: "m/84'/0'/0'",
        externalDescriptor: 'ext',
        fingerprint: 'abcd1234',
        internalDescriptor: 'int',
        wallet: {}
      })
    })
    seedBuilder()
  })

  it('stores the encrypted secret and keeps the plaintext in the builder', async () => {
    const result = renderBuilderFinish()

    const data = await finish(
      result,
      useAccountBuilderStore.getState().getAccountData()
    )

    const expected = `pin-digest|${JSON.stringify(SECRET)}`
    expect(storeKeySecret).toHaveBeenCalledWith(
      expect.any(String),
      0,
      expected,
      'iv'
    )
    expect(data?.accountWithEncryptedSecret.keys[0].secret).toBe(expected)
    expect(useAccountsStore.getState().accounts[0].keys[0].secret).toBe(
      expected
    )
    expect(useAccountBuilderStore.getState().keys[0].secret).toStrictEqual(
      SECRET
    )
  })

  it('keeps the origin path of each multisig key', async () => {
    const ownOrigin = "m/48'/1'/3'/2'"
    const defaultOrigin = "m/48'/1'/0'/2'"
    jest.mocked(getWalletData).mockResolvedValue({
      dbPath: 'db',
      derivationPath: defaultOrigin,
      externalDescriptor: 'ext',
      fingerprint: 'abcd1234',
      internalDescriptor: '',
      keyDerivationPaths: [ownOrigin, defaultOrigin],
      keyFingerprints: ['abcd1234', 'ef015678'],
      wallet: {}
    })
    useAccountBuilderStore.setState({
      keyCount: 2,
      keys: [0, 1].map((index) => ({
        creationType: 'importExtendedPub',
        index,
        iv: 'iv',
        scriptVersion: 'P2WSH',
        secret: { extendedPublicKey: `tpub${index}` }
      })),
      keysRequired: 2,
      policyType: 'multisig'
    })
    const result = renderBuilderFinish()

    const data = await finish(
      result,
      useAccountBuilderStore.getState().getAccountData()
    )

    expect(
      data?.accountWithEncryptedSecret.keys.map((key) => key.derivationPath)
    ).toStrictEqual([ownOrigin, defaultOrigin])
  })

  it('finishes on retry after an attempt that failed late', async () => {
    jest
      .mocked(useWalletsStore.getState().addAccountWallet)
      .mockImplementationOnce(() => {
        throw new Error('wallet store unavailable')
      })
    const result = renderBuilderFinish()
    const { getAccountData } = useAccountBuilderStore.getState()

    await expect(finish(result, getAccountData())).rejects.toThrow(
      'wallet store unavailable'
    )
    const data = await finish(result, getAccountData())

    expect(data?.accountWithEncryptedSecret.keys[0].secret).toBe(
      `pin-digest|${JSON.stringify(SECRET)}`
    )
  })
})
