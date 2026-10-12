import { MIN_USABLE_CHECKPOINT_HEIGHT } from '@/constants/sync'
import {
  type AccountSyncHistory,
  isTransactionHistoryLoading,
  shouldFullScan
} from '@/utils/accountSync'

function makeAccount(
  overrides: Partial<AccountSyncHistory> = {}
): AccountSyncHistory {
  return {
    addresses: [],
    transactions: [],
    ...overrides
  }
}

function addressAt(index: number, keychain: 'external' | 'internal') {
  return {
    address: `addr-${keychain}-${index}`,
    index,
    keychain,
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [],
    utxos: []
  }
}

describe('shouldFullScan', () => {
  it('full-scans when the user forced a rescan', () => {
    expect(
      shouldFullScan({
        account: makeAccount({
          addresses: [addressAt(0, 'external')],
          transactions: [{ id: 'tx1' }]
        }),
        checkpoint: { height: 800_000 },
        forceFullScan: true
      })
    ).toBe(true)
  })

  it('full-scans an empty new wallet with no checkpoint', () => {
    expect(
      shouldFullScan({
        account: makeAccount(),
        checkpoint: null,
        forceFullScan: false
      })
    ).toBe(true)
  })

  it('full-scans an empty wallet with a genesis-adjacent checkpoint', () => {
    expect(
      shouldFullScan({
        account: makeAccount(),
        checkpoint: { height: MIN_USABLE_CHECKPOINT_HEIGHT - 1 },
        forceFullScan: false
      })
    ).toBe(true)
  })

  it('stays incremental for Electrum to Esplora when history exists', () => {
    expect(
      shouldFullScan({
        account: makeAccount({ addresses: [addressAt(0, 'external')] }),
        checkpoint: { height: 800_000 },
        forceFullScan: false
      })
    ).toBe(false)
  })

  it('stays incremental when switching to a public server after a private Electrum', () => {
    expect(
      shouldFullScan({
        account: makeAccount({
          transactions: [{ id: 'tx1' }]
        }),
        checkpoint: { height: 850_000 },
        forceFullScan: false
      })
    ).toBe(false)
  })

  it('stays incremental after RPC when the account already has addresses', () => {
    expect(
      shouldFullScan({
        account: makeAccount({ addresses: [addressAt(4, 'external')] }),
        checkpoint: { height: 1_052 },
        forceFullScan: false
      })
    ).toBe(false)
  })

  it('stays incremental for a low checkpoint when txs exist', () => {
    expect(
      shouldFullScan({
        account: makeAccount({
          transactions: [{ id: 'tx1' }]
        }),
        checkpoint: { height: 500 },
        forceFullScan: false
      })
    ).toBe(false)
  })

  it('stays incremental for an empty wallet with a usable checkpoint', () => {
    expect(
      shouldFullScan({
        account: makeAccount(),
        checkpoint: { height: MIN_USABLE_CHECKPOINT_HEIGHT },
        forceFullScan: false
      })
    ).toBe(false)
  })
})

describe('isTransactionHistoryLoading', () => {
  it('is loading while the account is syncing', () => {
    expect(
      isTransactionHistoryLoading({ refreshing: false, syncStatus: 'syncing' })
    ).toBe(true)
  })

  it('is loading while a refresh is in flight before sync status flips', () => {
    expect(
      isTransactionHistoryLoading({ refreshing: true, syncStatus: 'unsynced' })
    ).toBe(true)
  })

  it('is not loading once the account has synced', () => {
    expect(
      isTransactionHistoryLoading({ refreshing: false, syncStatus: 'synced' })
    ).toBe(false)
  })

  it('is not loading after a failed sync', () => {
    expect(
      isTransactionHistoryLoading({ refreshing: false, syncStatus: 'error' })
    ).toBe(false)
  })

  it('is not loading when sync status is unknown', () => {
    expect(isTransactionHistoryLoading({ refreshing: false })).toBe(false)
  })
})
