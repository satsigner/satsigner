import { insertDms, replaceDm, updateDmStatus } from '@/db/mutations/nostr'
import { useAccountsStore } from '@/store/accounts'
import { useNostrStore } from '@/store/nostr'
import { type Account } from '@/types/models/Account'
import { type NostrDM } from '@/types/models/Nostr'

jest.mock<typeof import('@/db/mutations/nostr')>(
  '@/db/mutations/nostr',
  () => ({
    ...jest.requireActual('@/db/mutations/nostr'),
    insertDms: jest.fn(),
    replaceDm: jest.fn(),
    updateDmStatus: jest.fn()
  })
)

jest.mock<typeof import('@/db/mutations/accounts')>(
  '@/db/mutations/accounts',
  () => ({
    ...jest.requireActual('@/db/mutations/accounts'),
    deleteAccount: jest.fn()
  })
)

jest.mock<typeof import('@/utils/nostrSecrets')>(
  '@/utils/nostrSecrets',
  () => ({
    ...jest.requireActual('@/utils/nostrSecrets'),
    deleteNostrAccountSecretSafe: jest.fn().mockResolvedValue(undefined)
  })
)

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  ...jest.requireActual('@/storage/encrypted'),
  deleteAllKeySecrets: jest.fn()
}))

const ACCOUNT_ID = 'account-1'

function dm(id: string, createdAt: number): NostrDM {
  return {
    author: 'a'.repeat(64),
    created_at: createdAt,
    description: id,
    event: '',
    id,
    label: 1
  }
}

function account(dms: NostrDM[]): Account {
  return {
    addresses: [],
    createdAt: new Date(),
    id: ACCOUNT_ID,
    keyCount: 1,
    keys: [],
    keysRequired: 1,
    labels: {},
    name: 'Account',
    network: 'bitcoin',
    nostr: {
      autoSync: true,
      commonNpub: '',
      commonNsec: '',
      dms,
      lastUpdated: new Date(),
      relays: [],
      syncStart: new Date(),
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

function storedDms(): NostrDM[] {
  return (
    useAccountsStore.getState().accounts.find((a) => a.id === ACCOUNT_ID)?.nostr
      .dms ?? []
  )
}

describe('accounts store DM writes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAccountsStore.setState({ accounts: [account([dm('old', 10)])] })
  })

  it('adds only new DMs, sorted, and writes just those to SQLite', () => {
    const { addAccountDms } = useAccountsStore.getState()

    addAccountDms(ACCOUNT_ID, [dm('new', 5), dm('old', 10)])
    addAccountDms(ACCOUNT_ID, [dm('new', 5)])

    expect(storedDms().map((stored) => stored.id)).toStrictEqual(['new', 'old'])
    expect(insertDms).toHaveBeenCalledTimes(1)
    expect(insertDms).toHaveBeenCalledWith(ACCOUNT_ID, [dm('new', 5)])
  })

  it('updates the status of a single DM', () => {
    useAccountsStore
      .getState()
      .updateAccountDmStatus(ACCOUNT_ID, 'old', { pending: false, read: true })

    expect(updateDmStatus).toHaveBeenCalledWith(ACCOUNT_ID, 'old', {
      pending: false,
      read: true
    })
    expect(storedDms()[0]).toMatchObject({ pending: false, read: true })
  })

  it('replaces an optimistic DM with the relay copy', () => {
    useAccountsStore.setState({ accounts: [account([dm('pending-1', 10)])] })

    useAccountsStore
      .getState()
      .replaceAccountDm(ACCOUNT_ID, 'pending-1', dm('real', 11))

    expect(replaceDm).toHaveBeenCalledWith(
      ACCOUNT_ID,
      'pending-1',
      dm('real', 11)
    )
    expect(storedDms().map((stored) => stored.id)).toStrictEqual(['real'])
  })

  it('drops the account nostr state when the account is deleted', () => {
    useNostrStore.setState({
      lastProtocolEOSE: { [ACCOUNT_ID]: 100, other: 5 },
      trustedDevices: { [ACCOUNT_ID]: ['npub1x'] }
    })

    useAccountsStore.getState().deleteAccount(ACCOUNT_ID)

    expect(useNostrStore.getState().lastProtocolEOSE).toStrictEqual({
      other: 5
    })
    expect(useNostrStore.getState().trustedDevices).toStrictEqual({})
  })
})
