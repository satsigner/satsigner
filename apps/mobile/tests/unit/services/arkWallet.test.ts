import * as arkApi from '@/api/ark'
import { ARK_WALLET_LOCKED, ARK_WALLET_QUERY_KEY } from '@/constants/ark'
import { queryClient } from '@/lib/queryClient'
import {
  forgetArkNotificationSubscription,
  hasArkNotificationSubscription,
  isArkNotificationSubscriptionPending,
  setArkNotificationSubscription,
  setArkNotificationSubscriptionPending
} from '@/services/arkNotificationSubscriptions'
import {
  createArkWalletWhileUnlocked,
  ensureArkWalletOpen,
  releaseAllArkWalletsAndSubscriptions
} from '@/services/arkWallet'
import * as arkDatadir from '@/storage/arkDatadir'
import * as encrypted from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import type { ArkAccount, ArkWalletArgs } from '@/types/models/Ark'

const ARK_ACCOUNT: ArkAccount = {
  bitcoinAccountId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'ark-1',
  name: 'Ark',
  network: 'signet',
  serverId: 'second'
}
const DATADIR = '/tmp/ark-1'
const MNEMONIC = 'test test test test test test test test test test test junk'
const WALLET_ARGS: ArkWalletArgs = {
  accountId: ARK_ACCOUNT.id,
  datadir: DATADIR,
  mnemonic: MNEMONIC,
  server: {
    arkUrl: 'https://ark.test',
    esploraUrl: 'https://esplora.test',
    id: 'second',
    name: 'Second',
    network: 'signet'
  }
}

function lockApp() {
  useAuthStore.setState({ lockTriggered: true })
}

describe('ensureArkWalletOpen', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    useArkStore.getState().clearAllData()
    useArkStore.getState().addAccount(ARK_ACCOUNT)
    useAuthStore.setState({
      lockTriggered: false,
      requiresAuth: true,
      skipPin: false
    })
    jest.spyOn(arkDatadir, 'ensureArkDatadir').mockResolvedValue(DATADIR)
  })

  it('opens the wallet while the app is unlocked', async () => {
    jest.spyOn(encrypted, 'getArkMnemonic').mockResolvedValue(MNEMONIC)
    const open = jest.spyOn(arkApi, 'openArkWallet').mockResolvedValue()

    await expect(ensureArkWalletOpen(ARK_ACCOUNT.id)).resolves.toBe(true)

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: ARK_ACCOUNT.id,
        datadir: DATADIR,
        mnemonic: MNEMONIC
      })
    )
  })

  it('does not open the wallet when the app locks while it is loading', async () => {
    jest.spyOn(encrypted, 'getArkMnemonic').mockImplementation(() => {
      lockApp()
      return Promise.resolve(MNEMONIC)
    })
    const open = jest.spyOn(arkApi, 'openArkWallet').mockResolvedValue()

    await expect(ensureArkWalletOpen(ARK_ACCOUNT.id)).rejects.toThrow(
      ARK_WALLET_LOCKED
    )

    expect(open).not.toHaveBeenCalled()
  })
})

describe('createArkWalletWhileUnlocked', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    useAuthStore.setState({
      lockTriggered: false,
      requiresAuth: true,
      skipPin: false
    })
  })

  it('creates the wallet while the app is unlocked', async () => {
    const create = jest.spyOn(arkApi, 'createArkWallet').mockResolvedValue()

    await createArkWalletWhileUnlocked(WALLET_ARGS)

    expect(create).toHaveBeenCalledWith(WALLET_ARGS)
  })

  it('does not create the wallet once the app has locked', async () => {
    lockApp()
    const create = jest.spyOn(arkApi, 'createArkWallet').mockResolvedValue()

    await expect(createArkWalletWhileUnlocked(WALLET_ARGS)).rejects.toThrow(
      ARK_WALLET_LOCKED
    )

    expect(create).not.toHaveBeenCalled()
  })
})

describe('releaseAllArkWalletsAndSubscriptions', () => {
  const walletQueryKey = [...ARK_WALLET_QUERY_KEY, ARK_ACCOUNT.id]

  beforeEach(() => {
    jest.restoreAllMocks()
    queryClient.clear()
  })

  afterEach(() => {
    setArkNotificationSubscription(ARK_ACCOUNT.id, jest.fn())
    forgetArkNotificationSubscription(ARK_ACCOUNT.id)
  })

  it('forgets the subscriptions and open wallet answers, then releases the wallets', async () => {
    const unsubscribe = jest.fn()
    setArkNotificationSubscription(ARK_ACCOUNT.id, unsubscribe)
    setArkNotificationSubscriptionPending('ark-2', true)
    queryClient.setQueryData(walletQueryKey, true)
    const release = jest
      .spyOn(arkApi, 'releaseAllArkWallets')
      .mockResolvedValue()

    await releaseAllArkWalletsAndSubscriptions()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(hasArkNotificationSubscription(ARK_ACCOUNT.id)).toBe(false)
    expect(isArkNotificationSubscriptionPending('ark-2')).toBe(false)
    expect(queryClient.getQueryData(walletQueryKey)).toBeUndefined()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('still releases the wallets when an unsubscribe throws', async () => {
    setArkNotificationSubscription(ARK_ACCOUNT.id, () => {
      throw new Error('native unsubscribe failed')
    })
    const release = jest
      .spyOn(arkApi, 'releaseAllArkWallets')
      .mockResolvedValue()

    await expect(releaseAllArkWalletsAndSubscriptions()).rejects.toThrow(
      'native unsubscribe failed'
    )

    expect(release).toHaveBeenCalledTimes(1)
  })
})
