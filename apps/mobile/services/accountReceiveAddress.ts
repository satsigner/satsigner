import { getWalletData } from '@/api/bdk'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { type Account } from '@/types/models/Account'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getAccountWithDecryptedKeys } from '@/utils/decryption'
import { findFirstUnusedExternalAddress } from '@/utils/derivedAddress'

// Addresses already handed to a send in this session. The account's
// transactions show them only after its next sync, so without this two sends
// in a row would pay the same address.
const issuedAddresses = new Map<string, Set<string>>()

async function loadAccountWallet(account: Account) {
  const loaded = useWalletsStore.getState().wallets[account.id]
  if (loaded) {
    return loaded
  }
  const decrypted = await getAccountWithDecryptedKeys(account)
  const walletData = await getWalletData(
    decrypted,
    appNetworkToBdkNetwork(account.network)
  )
  return walletData?.wallet
}

function collectUsedAddresses(
  account: Account,
  reservedAddresses: readonly string[]
): Set<string> {
  const paidAddresses = account.transactions.flatMap((transaction) =>
    transaction.vout.flatMap((output) =>
      output.address ? [output.address] : []
    )
  )
  return new Set([
    ...paidAddresses,
    ...(issuedAddresses.get(account.id) ?? []),
    ...reservedAddresses
  ])
}

function pickFreshAddress(
  wallet: Awaited<ReturnType<typeof loadAccountWallet>>,
  account: Account,
  reservedAddresses: readonly string[]
): string {
  const addressInfo = wallet
    ? findFirstUnusedExternalAddress(
        wallet,
        collectUsedAddresses(account, reservedAddresses)
      )
    : undefined
  if (!addressInfo) {
    throw new Error(t('account.error.noFreshAddress'))
  }
  return addressInfo.address
}

function getStoredAccount(account: Account): Account {
  return (
    useAccountsStore
      .getState()
      .accounts.find((stored) => stored.id === account.id) ?? account
  )
}

function issueAddress(accountId: string, address: string) {
  const issued = issuedAddresses.get(accountId) ?? new Set<string>()
  issued.add(address)
  issuedAddresses.set(accountId, issued)
}

/**
 * First external address of the account that no known transaction pays and
 * no earlier send took, derived from the account's own descriptor. Only for
 * estimates: the address is not reserved.
 */
export async function peekFreshReceiveAddress(
  account: Account
): Promise<string> {
  const wallet = await loadAccountWallet(account)
  return pickFreshAddress(wallet, account, [])
}

/**
 * Same as `peekFreshReceiveAddress`, and reserves the address so later sends
 * skip it. `reservedAddresses` adds ones taken before this session.
 */
export async function reserveFreshReceiveAddress(
  account: Account,
  reservedAddresses: readonly string[] = []
): Promise<string> {
  const wallet = await loadAccountWallet(account)
  // Picking and reserving must not straddle an await, or two concurrent
  // sends could pick the same address.
  const address = pickFreshAddress(wallet, account, reservedAddresses)
  issueAddress(account.id, address)
  return address
}

/**
 * Reserves `address` only while it is still the account's fresh address, for
 * a draft built on a peeked one. When another send took it first, nothing is
 * reserved, so the next address is not skipped for the rest of the session.
 * Freshness is checked against the account as stored now, as the caller's
 * copy can predate a sync that saw the address paid.
 */
export async function reserveReceiveAddressIfFresh(
  account: Account,
  address: string
): Promise<boolean> {
  const wallet = await loadAccountWallet(account)
  if (pickFreshAddress(wallet, getStoredAccount(account), []) !== address) {
    return false
  }
  issueAddress(account.id, address)
  return true
}
