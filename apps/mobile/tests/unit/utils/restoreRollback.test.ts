import {
  deleteArkMnemonic,
  deleteEcashMnemonic,
  deleteNostrIdentitySecret,
  getArkMnemonic,
  getEcashMnemonic,
  getKeySecret,
  getNostrAccountSecret,
  getNostrIdentitySecret,
  storeArkMnemonic,
  storeEcashMnemonic,
  storeKeySecret,
  storeNostrAccountSecret,
  storeNostrIdentitySecret
} from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import type { Account } from '@/types/models/Account'
import {
  rollbackPersistedState,
  snapshotPersistedState
} from '@/utils/restoreRollback'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  deleteArkMnemonic: jest.fn().mockResolvedValue(undefined),
  deleteEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  deleteNostrIdentitySecret: jest.fn().mockResolvedValue(undefined),
  getArkMnemonic: jest.fn(),
  getEcashMnemonic: jest.fn(),
  getKeySecret: jest.fn(),
  getNostrAccountSecret: jest.fn().mockResolvedValue(null),
  getNostrIdentitySecret: jest.fn().mockResolvedValue(null),
  storeArkMnemonic: jest.fn().mockResolvedValue(undefined),
  storeEcashMnemonic: jest.fn().mockResolvedValue(undefined),
  storeKeySecret: jest.fn().mockResolvedValue(undefined),
  storeNostrAccountSecret: jest.fn().mockResolvedValue(undefined),
  storeNostrIdentitySecret: jest.fn().mockResolvedValue(undefined)
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: jest.fn() }
}))

jest.mock<typeof import('@/store/nostrIdentity')>(
  '@/store/nostrIdentity',
  () => ({
    useNostrIdentityStore: { getState: jest.fn() }
  })
)

const mockGetState = jest.mocked(useAccountsStore.getState)
const mockIdentityState = jest.mocked(useNostrIdentityStore.getState)
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
    mockIdentityState.mockReturnValue({
      identities: []
    } as unknown as ReturnType<typeof useNostrIdentityStore.getState>)
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

  it('snapshots nostr identity and account secrets as stored', async () => {
    mockGetState.mockReturnValue({
      accounts: [account('acc-1', 0)]
    } as unknown as ReturnType<typeof useAccountsStore.getState>)
    mockIdentityState.mockReturnValue({
      identities: [{ npub: 'npub1old' }, { npub: 'npub1empty' }]
    } as unknown as ReturnType<typeof useNostrIdentityStore.getState>)
    jest
      .mocked(getNostrIdentitySecret)
      .mockResolvedValueOnce({ iv: 'id-iv', secret: 'id-secret' })
      .mockResolvedValueOnce(null)
    jest
      .mocked(getNostrAccountSecret)
      .mockResolvedValueOnce({ iv: 'acc-iv', secret: 'acc-secret' })

    const snapshot = await snapshotPersistedState({
      arkAccountIds: [],
      ecashAccountIds: []
    })

    expect(snapshot.nostrIdentitySecrets).toStrictEqual([
      { iv: 'id-iv', npub: 'npub1old', secret: 'id-secret' }
    ])
    expect(snapshot.nostrAccountSecrets).toStrictEqual([
      { accountId: 'acc-1', iv: 'acc-iv', secret: 'acc-secret' }
    ])
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
        ],
        nostrAccountSecrets: [],
        nostrIdentitySecrets: []
      },
      {
        arkAccountIds: ['new-ark'],
        ecashAccountIds: ['shared-ecash'],
        nostrIdentityNpubs: []
      }
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

  it('rewrites nostr secrets from the snapshot and drops restored identities', async () => {
    mockGetState.mockReturnValue({
      addAccount,
      deleteAccounts
    } as unknown as ReturnType<typeof useAccountsStore.getState>)

    await rollbackPersistedState(
      {
        accounts: [account('old-account', 0)],
        arkMnemonics: [],
        ecashMnemonics: [],
        keySecrets: [],
        nostrAccountSecrets: [
          { accountId: 'old-account', iv: 'acc-iv', secret: 'acc-secret' }
        ],
        nostrIdentitySecrets: [
          { iv: 'id-iv', npub: 'npub1shared', secret: 'id-secret' }
        ]
      },
      {
        arkAccountIds: [],
        ecashAccountIds: [],
        nostrIdentityNpubs: ['npub1shared', 'npub1backup']
      }
    )

    expect(storeNostrIdentitySecret).toHaveBeenCalledWith(
      'npub1shared',
      'id-secret',
      'id-iv'
    )
    expect(storeNostrAccountSecret).toHaveBeenCalledWith(
      'old-account',
      'acc-secret',
      'acc-iv'
    )
    expect(deleteNostrIdentitySecret).toHaveBeenCalledTimes(1)
    expect(deleteNostrIdentitySecret).toHaveBeenCalledWith('npub1backup')
  })
})
