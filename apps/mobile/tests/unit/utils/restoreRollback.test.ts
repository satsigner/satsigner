import {
  deleteArkMnemonic,
  deleteEcashMnemonic,
  getArkMnemonic,
  getEcashMnemonic,
  getKeySecret,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import type { Account } from '@/types/models/Account'
import {
  rollbackPersistedState,
  snapshotPersistedState
} from '@/utils/restoreRollback'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  deleteArkMnemonic: jest.fn().mockResolvedValue(undefined),
  deleteEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  getArkMnemonic: jest.fn(),
  getEcashMnemonic: jest.fn(),
  getKeySecret: jest.fn(),
  storeArkMnemonic: jest.fn().mockResolvedValue(undefined),
  storeEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  storeKeySecret: jest.fn().mockResolvedValue(undefined)
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: jest.fn() }
}))

const mockGetState = jest.mocked(useAccountsStore.getState)
const addAccount = jest.fn()
const deleteAccounts = jest.fn().mockResolvedValue(undefined)

function account(id: string, keyCount: number): Account {
  return {
    id,
    keys: Array.from({ length: keyCount }, (_, index) => ({ index }))
  } as unknown as Account
}

describe('restoreRollback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('snapshots accounts, encrypted key secrets and mnemonics as stored', async () => {
    mockGetState.mockReturnValue({
      accounts: [account('acc-1', 2)]
    } as unknown as ReturnType<typeof useAccountsStore.getState>)
    jest
      .mocked(getKeySecret)
      .mockResolvedValueOnce({ iv: 'iv0', secret: 's0' })
      .mockResolvedValueOnce(null)
    jest.mocked(getEcashMnemonic).mockResolvedValueOnce('ecash words')
    jest.mocked(getArkMnemonic).mockResolvedValueOnce(null)

    const snapshot = await snapshotPersistedState({
      arkAccountIds: ['ark-1'],
      ecashAccountIds: ['ecash-1']
    })

    expect(snapshot.keySecrets).toStrictEqual([
      { accountId: 'acc-1', index: 0, iv: 'iv0', secret: 's0' }
    ])
    expect(snapshot.ecashMnemonics).toStrictEqual([
      { accountId: 'ecash-1', mnemonic: 'ecash words' }
    ])
    expect(snapshot.arkMnemonics).toStrictEqual([])
  })

  it('puts the previous accounts and secrets back and drops restored ones', async () => {
    mockGetState.mockReturnValue({
      addAccount,
      deleteAccounts
    } as unknown as ReturnType<typeof useAccountsStore.getState>)
    const previous = account('old-account', 1)

    await rollbackPersistedState(
      {
        accounts: [previous],
        arkMnemonics: [{ accountId: 'old-ark', mnemonic: 'ark words' }],
        ecashMnemonics: [{ accountId: 'shared-ecash', mnemonic: 'old words' }],
        keySecrets: [
          { accountId: 'old-account', index: 0, iv: 'iv', secret: 'secret' }
        ]
      },
      { arkAccountIds: ['new-ark'], ecashAccountIds: ['shared-ecash'] }
    )

    expect(deleteAccounts).toHaveBeenCalledTimes(1)
    expect(addAccount).toHaveBeenCalledWith(previous)
    expect(storeKeySecret).toHaveBeenCalledWith(
      'old-account',
      0,
      'secret',
      'iv'
    )
    expect(storeEcashMnemonic).toHaveBeenCalledWith('shared-ecash', 'old words')
    expect(storeArkMnemonic).toHaveBeenCalledWith('old-ark', 'ark words')
    expect(deleteArkMnemonic).toHaveBeenCalledWith('new-ark')
    expect(deleteEcashMnemonic).not.toHaveBeenCalled()
  })
})
