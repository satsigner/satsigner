import { FULL_ADDRESS_CHECK_AFTER_MS } from '@/constants/sync'
import type { Account } from '@/types/models/Account'

type Keychain = NonNullable<Account['addresses'][number]['keychain']>

/**
 * What the server reports for one address. Confirmed history is compared by
 * count (Esplora reports counts without paging through history); unconfirmed
 * history by txid, so a replaced transaction is noticed.
 */
type AddressActivity = {
  address: string
  confirmedCount: number
  unconfirmedTxids: readonly string[]
}

type QuickCheckAccount = Pick<Account, 'addresses' | 'transactions' | 'utxos'>

const KEYCHAINS: readonly Keychain[] = ['external', 'internal']

function isConfirmed(blockHeight: number | undefined) {
  return blockHeight !== undefined && blockHeight > 0
}

function lastUsedIndex(account: QuickCheckAccount, keychain: Keychain) {
  const usedIndexes = account.addresses
    .filter(
      (address) =>
        address.keychain === keychain && address.transactions.length > 0
    )
    .map((address) => address.index ?? -1)
  return Math.max(-1, ...usedIndexes)
}

function unusedAddressesAfterLastUsed(
  account: QuickCheckAccount,
  keychain: Keychain,
  stopGap: number
) {
  const lastUsed = lastUsedIndex(account, keychain)
  return account.addresses.filter(
    ({ index, keychain: addressKeychain }) =>
      addressKeychain === keychain &&
      index !== undefined &&
      index > lastUsed &&
      index <= lastUsed + stopGap
  )
}

/**
 * The addresses whose history can change if no address is reused: those
 * holding a UTXO (a spend), those with an unconfirmed transaction (it
 * confirms, or is replaced or evicted), and the unused ones after the last
 * used address of each keychain, up to the stop gap (a new payment).
 */
function getQuickCheckAddresses(
  account: QuickCheckAccount,
  stopGap: number
): string[] {
  const selected = new Set<string>()

  for (const utxo of account.utxos) {
    if (utxo.addressTo) {
      selected.add(utxo.addressTo)
    }
  }

  const unconfirmed = new Set(
    account.transactions
      .filter((tx) => !isConfirmed(tx.blockHeight))
      .map((tx) => tx.id)
  )
  for (const address of account.addresses) {
    if (address.transactions.some((txid) => unconfirmed.has(txid))) {
      selected.add(address.address)
    }
  }

  for (const keychain of KEYCHAINS) {
    for (const address of unusedAddressesAfterLastUsed(
      account,
      keychain,
      stopGap
    )) {
      selected.add(address.address)
    }
  }

  return [...selected]
}

function knownActivity(account: QuickCheckAccount) {
  const blockHeightByTxid = new Map(
    account.transactions.map((tx) => [tx.id, tx.blockHeight])
  )
  return new Map(
    account.addresses.map((address) => {
      const confirmed = address.transactions.filter((txid) =>
        isConfirmed(blockHeightByTxid.get(txid))
      )
      const unconfirmed = address.transactions.filter(
        (txid) => !isConfirmed(blockHeightByTxid.get(txid))
      )
      return [
        address.address,
        { confirmedCount: confirmed.length, unconfirmed: new Set(unconfirmed) }
      ]
    })
  )
}

/**
 * Whether the server reports activity the account doesn't have: a new
 * payment or spend, a confirmation, or an unconfirmed transaction that was
 * replaced or evicted.
 */
function hasActivityChanged(
  account: QuickCheckAccount,
  activity: readonly AddressActivity[]
): boolean {
  const known = knownActivity(account)
  return activity.some(({ address, confirmedCount, unconfirmedTxids }) => {
    const entry = known.get(address)
    if (!entry) {
      return true
    }
    if (entry.confirmedCount !== confirmedCount) {
      return true
    }
    if (entry.unconfirmed.size !== unconfirmedTxids.length) {
      return true
    }
    return unconfirmedTxids.some((txid) => !entry.unconfirmed.has(txid))
  })
}

type CanQuickCheckParams = {
  account: Pick<
    Account,
    'addresses' | 'lastFullCheckAt' | 'lastSyncedAt' | 'syncStatus'
  >
  nowMs: number
}

/**
 * A quick check stands in for a sync only after one that checked every
 * address, and for at most FULL_ADDRESS_CHECK_AFTER_MS after it: a payment
 * to a reused address is only found by a full check.
 */
function canQuickCheck({ account, nowMs }: CanQuickCheckParams): boolean {
  if (account.syncStatus === 'unsynced' || account.addresses.length === 0) {
    return false
  }
  if (!account.lastSyncedAt || !account.lastFullCheckAt) {
    return false
  }
  const sinceFullCheckMs = nowMs - new Date(account.lastFullCheckAt).getTime()
  return (
    !Number.isNaN(sinceFullCheckMs) &&
    sinceFullCheckMs >= 0 &&
    sinceFullCheckMs < FULL_ADDRESS_CHECK_AFTER_MS
  )
}

export { canQuickCheck, getQuickCheckAddresses, hasActivityChanged }
export type { AddressActivity }
