import { FULL_ADDRESS_CHECK_AFTER_MS } from '@/constants/sync'
import type { Account } from '@/types/models/Account'
import type { Address } from '@/types/models/Address'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'
import {
  canQuickCheck,
  getQuickCheckAddresses,
  hasActivityChanged
} from '@/utils/quickCheck'

const STOP_GAP = 3
const NOW_MS = Date.UTC(2026, 10, 24)

function makeAddress(
  keychain: 'external' | 'internal',
  index: number,
  transactions: string[] = []
): Address {
  return {
    address: `${keychain}-${index}`,
    index,
    keychain,
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions,
    utxos: []
  }
}

function makeTx(id: string, blockHeight?: number): Transaction {
  return {
    blockHeight,
    id,
    lockTimeEnabled: false,
    prices: {},
    received: 0,
    sent: 0,
    type: 'receive',
    vin: [],
    vout: []
  }
}

function makeUtxo(addressTo: string, txid: string): Utxo {
  return { addressTo, keychain: 'external', txid, value: 1000, vout: 0 }
}

type QuickCheckAccount = Pick<Account, 'addresses' | 'transactions' | 'utxos'>

/**
 * External 0..2 used (0 and 1 confirmed and spent, 2 holding a UTXO), then
 * unused 3..9. Internal 0 holds the change of an unconfirmed send.
 */
function makeAccount(): QuickCheckAccount {
  const external = [
    makeAddress('external', 0, ['a']),
    makeAddress('external', 1, ['b', 'spend']),
    makeAddress('external', 2, ['c']),
    ...[3, 4, 5, 6, 7, 8, 9].map((index) => makeAddress('external', index))
  ]
  const internal = [
    makeAddress('internal', 0, ['pending']),
    ...[1, 2, 3, 4, 5].map((index) => makeAddress('internal', index))
  ]
  return {
    addresses: [...external, ...internal],
    transactions: [
      makeTx('a', 100),
      makeTx('b', 101),
      makeTx('spend', 102),
      makeTx('c', 103),
      makeTx('pending')
    ],
    utxos: [makeUtxo('external-2', 'c'), makeUtxo('internal-0', 'pending')]
  }
}

describe('getQuickCheckAddresses', () => {
  it('checks UTXO, unconfirmed and gap addresses, not old spent ones', () => {
    const addresses = getQuickCheckAddresses(makeAccount(), STOP_GAP)

    expect(addresses.toSorted()).toStrictEqual(
      [
        'external-2',
        'external-3',
        'external-4',
        'external-5',
        'internal-0',
        'internal-1',
        'internal-2',
        'internal-3'
      ].toSorted()
    )
  })

  it('checks the first addresses of a keychain that was never used', () => {
    const account: QuickCheckAccount = {
      addresses: [0, 1, 2, 3, 4].map((index) => makeAddress('internal', index)),
      transactions: [],
      utxos: []
    }

    expect(getQuickCheckAddresses(account, STOP_GAP)).toStrictEqual([
      'internal-0',
      'internal-1',
      'internal-2'
    ])
  })
})

function activityFor(account: QuickCheckAccount) {
  const heights = new Map(
    account.transactions.map((tx) => [tx.id, tx.blockHeight])
  )
  return account.addresses.map((address) => ({
    address: address.address,
    confirmedCount: address.transactions.filter(
      (txid) => (heights.get(txid) ?? 0) > 0
    ).length,
    unconfirmedTxids: address.transactions.filter(
      (txid) => (heights.get(txid) ?? 0) <= 0
    )
  }))
}

describe('hasActivityChanged', () => {
  it('reports no change when the server agrees with the account', () => {
    const account = makeAccount()
    expect(hasActivityChanged(account, activityFor(account))).toBe(false)
  })

  it('notices a payment to an unused address', () => {
    const account = makeAccount()
    const activity = activityFor(account).map((entry) =>
      entry.address === 'external-4'
        ? { ...entry, unconfirmedTxids: ['incoming'] }
        : entry
    )
    expect(hasActivityChanged(account, activity)).toBe(true)
  })

  it('notices a UTXO spent elsewhere', () => {
    const account = makeAccount()
    const activity = activityFor(account).map((entry) =>
      entry.address === 'external-2'
        ? { ...entry, confirmedCount: entry.confirmedCount + 1 }
        : entry
    )
    expect(hasActivityChanged(account, activity)).toBe(true)
  })

  it('notices a confirmation', () => {
    const account = makeAccount()
    const activity = activityFor(account).map((entry) =>
      entry.address === 'internal-0'
        ? { ...entry, confirmedCount: 1, unconfirmedTxids: [] }
        : entry
    )
    expect(hasActivityChanged(account, activity)).toBe(true)
  })

  it('notices a replaced unconfirmed transaction', () => {
    const account = makeAccount()
    const activity = activityFor(account).map((entry) =>
      entry.address === 'internal-0'
        ? { ...entry, unconfirmedTxids: ['replacement'] }
        : entry
    )
    expect(hasActivityChanged(account, activity)).toBe(true)
  })

  it('reports an address the account does not know as changed', () => {
    const account = makeAccount()
    expect(
      hasActivityChanged(account, [
        { address: 'unknown', confirmedCount: 0, unconfirmedTxids: [] }
      ])
    ).toBe(true)
  })
})

describe('canQuickCheck', () => {
  const synced = {
    addresses: makeAccount().addresses,
    lastFullCheckAt: new Date(NOW_MS - 60_000),
    lastSyncedAt: new Date(NOW_MS - 60_000),
    syncStatus: 'synced' as const
  }

  it('allows a quick check soon after a full check', () => {
    expect(canQuickCheck({ account: synced, nowMs: NOW_MS })).toBe(true)
  })

  it('needs a full check first', () => {
    expect(
      canQuickCheck({
        account: { ...synced, lastFullCheckAt: undefined },
        nowMs: NOW_MS
      })
    ).toBe(false)
  })

  it('checks every address again once the full check is old', () => {
    expect(
      canQuickCheck({
        account: {
          ...synced,
          lastFullCheckAt: new Date(NOW_MS - FULL_ADDRESS_CHECK_AFTER_MS)
        },
        nowMs: NOW_MS
      })
    ).toBe(false)
  })

  it('does not quick check an unsynced account or one without addresses', () => {
    expect(
      canQuickCheck({
        account: { ...synced, syncStatus: 'unsynced' },
        nowMs: NOW_MS
      })
    ).toBe(false)
    expect(
      canQuickCheck({ account: { ...synced, addresses: [] }, nowMs: NOW_MS })
    ).toBe(false)
  })

  it('does not trust a full check dated in the future', () => {
    expect(
      canQuickCheck({
        account: { ...synced, lastFullCheckAt: new Date(NOW_MS + 60_000) },
        nowMs: NOW_MS
      })
    ).toBe(false)
  })
})
