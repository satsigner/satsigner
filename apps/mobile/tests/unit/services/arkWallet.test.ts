import * as arkApi from '@/api/ark'
import { ARK_WALLET_LOCKED } from '@/constants/ark'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import * as arkDatadir from '@/storage/arkDatadir'
import * as encrypted from '@/storage/encrypted'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import type { ArkAccount } from '@/types/models/Ark'

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
      useAuthStore.setState({ lockTriggered: true })
      return Promise.resolve(MNEMONIC)
    })
    const open = jest.spyOn(arkApi, 'openArkWallet').mockResolvedValue()

    await expect(ensureArkWalletOpen(ARK_ACCOUNT.id)).rejects.toThrow(
      ARK_WALLET_LOCKED
    )

    expect(open).not.toHaveBeenCalled()
  })
})
