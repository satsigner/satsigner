import {
  type BdkWallet,
  KeychainKind,
  type Network
} from 'react-native-bdk-sdk'

import {
  BDK_RESCAN_MAX_POLLS,
  BDK_RESCAN_POLL_INTERVAL_MS,
  BDK_RESCAN_POLL_MAX_CONSECUTIVE_ERRORS,
  BDK_RESCAN_START_RACE_TIMEOUT_MS,
  BDK_RESCAN_STOP_POLL_INTERVAL_MS,
  BDK_RESCAN_STOP_POLL_MAX_ATTEMPTS,
  BDK_SECONDS_PER_BLOCK
} from '@/constants/bdk'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import { SYNC_CANCELLED_ERROR } from '@/constants/sync'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type RpcCredentials } from '@/types/settings/blockchain'
import { computeRpcScanStartHeight } from '@/utils/rpcScanStartHeight'
import {
  annotateTransactionsWithWalletOwnership,
  collectTransactionOutputAddresses,
  ensureAddressesIncludeSeenOutputs,
  ownershipScanLimit
} from '@/utils/walletOwnership'

import {
  appendAddressAtIndex,
  getPublicDescriptorsForAccount,
  maxCoreKeychainIndex,
  resolveRpcWalletName,
  revealKnownAddresses,
  toAppNetwork
} from './bdk'
import {
  BitcoinCoreWallet,
  type CoreTxDetails,
  type CoreWalletInfo,
  type CoreWalletListTx
} from './rpc'

type CoreWalletSyncProgress = (
  currentHeight: number,
  tipHeight: number,
  meta?: {
    currentBlockTimeSec?: number
    scanFromTimeSec?: number
    transactionsFound?: number
  }
) => void

type WalletTxEntry = Pick<
  CoreWalletListTx,
  'amount' | 'blockheight' | 'blocktime' | 'category' | 'time' | 'txid'
>

type WalletTxSummary = {
  blockheight?: number
  blocktime?: number
  received: number
  sent: number
}

type AppNetwork = Account['addresses'][number]['network']

const ALREADY_RESCANNING_ERROR = 'already rescanning'

const DESCRIPTOR_CHECKSUM_REGEX = /#[a-z0-9]{8}$/
const MULTIPATH_DESCRIPTOR_REGEX = /^(.+?)<(\d+);(\d+)>(.+?)(?:#.*)?$/

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const btcToSats = (btc: number) => Math.round(btc * SATS_PER_BITCOIN)

const hexToBytes = (hex: string) =>
  (hex.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))

const toUnixSec = (date?: Date) =>
  date ? Math.floor(date.getTime() / 1000) : undefined

function isAlreadyRescanning(error: unknown) {
  return (
    error instanceof Error && error.message.includes(ALREADY_RESCANNING_ERROR)
  )
}

/**
 * Public descriptors from the already-initialized BDK wallet, so the
 * (possibly encrypted) mnemonic is not touched again. Falls back to deriving
 * them from the account keys.
 */
function getWalletPublicDescriptors(
  account: Account,
  wallet: BdkWallet,
  network: Network
): [string, string] {
  try {
    return [
      wallet.publicDescriptor(KeychainKind.External),
      wallet.publicDescriptor(KeychainKind.Internal)
    ]
  } catch {
    const descriptors = getPublicDescriptorsForAccount(account, network)
    if (!descriptors) {
      throw new Error(
        'Could not derive public descriptors for this account. ' +
          'Core wallet sync requires a mnemonic, xpub, or descriptor-based account.'
      )
    }
    return descriptors
  }
}

/**
 * Strip checksums and split `<0;1>` multi-path descriptors into the
 * single-path external/internal pair Core's getdescriptorinfo expects.
 */
function toSinglePathDescriptors(
  external: string,
  internal: string
): [string, string] {
  const ext = external.replace(DESCRIPTOR_CHECKSUM_REGEX, '')
  const int = internal.replace(DESCRIPTOR_CHECKSUM_REGEX, '')
  const extMatch = ext.match(MULTIPATH_DESCRIPTOR_REGEX)
  const intMatch = int.match(MULTIPATH_DESCRIPTOR_REGEX)
  return [
    extMatch ? `${extMatch[1]}${extMatch[2]}${extMatch[4]}` : ext,
    intMatch ? `${intMatch[1]}${intMatch[3]}${intMatch[4]}` : int
  ]
}

/**
 * Import descriptors into an empty Core wallet. Returns whether a rescan is
 * needed: after a fresh import, or when no prior sync point is stored.
 */
async function importDescriptorsIfNeeded(
  coreWallet: BitcoinCoreWallet,
  account: Account,
  [external, internal]: [string, string],
  stopGap: number
): Promise<boolean> {
  try {
    const existing = await coreWallet.listDescriptors()
    if (existing.descriptors.length > 0) {
      return !account.rpcLastBlockHash
    }

    const results = await coreWallet.importDescriptors([
      {
        active: true,
        desc: external,
        internal: false,
        range: [0, stopGap],
        timestamp: 'now'
      },
      {
        active: true,
        desc: internal,
        internal: true,
        range: [0, stopGap],
        timestamp: 'now'
      }
    ])
    const failed = results.find((result) => !result.success && result.error)
    if (failed?.error) {
      throw new Error(
        `importdescriptors failed: ${failed.error.message} (code ${failed.error.code})`
      )
    }
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('listdescriptors')) {
      throw error
    }
    return false
  }
}

function latestCheckpointHeight(wallet: BdkWallet) {
  try {
    return wallet.latestCheckpoint()?.height
  } catch {
    return undefined
  }
}

/**
 * Start height priority: server override, birthday estimate, BDK checkpoint
 * minus a buffer, genesis.
 */
function resolveStartHeight(
  account: Account,
  wallet: BdkWallet,
  tipHeight: number,
  rpcScanFromHeight?: number
): number {
  return computeRpcScanStartHeight({
    birthdayDate: account.birthdayDate,
    checkpointHeight: latestCheckpointHeight(wallet),
    currentTip: tipHeight,
    rpcScanFromHeight
  })
}

/**
 * Abort any in-progress Core rescan (e.g. an earlier scan from genesis) and
 * wait until Core reports it stopped.
 */
async function waitForRescanStopped(
  coreWallet: BitcoinCoreWallet,
  isCancelled?: () => boolean
) {
  try {
    const info = await coreWallet.getWalletInfo()
    if (info.scanning === false) {
      return
    }
    await coreWallet.abortRescan()
  } catch {
    // ignore — may not be scanning, or older Core without abortrescan
  }

  for (let i = 0; i < BDK_RESCAN_STOP_POLL_MAX_ATTEMPTS; i += 1) {
    if (isCancelled?.()) {
      throw new Error(SYNC_CANCELLED_ERROR)
    }
    const scanning = await coreWallet
      .getWalletInfo()
      .then((info) => info.scanning !== false)
      .catch(() => false)
    if (!scanning) {
      return
    }
    await sleep(BDK_RESCAN_STOP_POLL_INTERVAL_MS)
  }
}

/**
 * Resolves when `rescanblockchain` returns, or after a timeout while Core
 * keeps scanning in the background (progress is then polled).
 */
async function startRescan(
  coreWallet: BitcoinCoreWallet,
  startHeight: number
): Promise<void> {
  const timers: ReturnType<typeof setTimeout>[] = []
  const timedOut = new Promise<void>((resolve) => {
    timers.push(setTimeout(resolve, BDK_RESCAN_START_RACE_TIMEOUT_MS))
  })
  try {
    await Promise.race([coreWallet.rescanBlockchain(startHeight), timedOut])
  } finally {
    for (const timer of timers) {
      clearTimeout(timer)
    }
  }
}

/**
 * Start a rescan from `startHeight`. If another client is already rescanning,
 * abort it and retry once; a second "already rescanning" is tolerated.
 */
async function startRescanFrom(
  coreWallet: BitcoinCoreWallet,
  startHeight: number,
  isCancelled?: () => boolean
) {
  try {
    await startRescan(coreWallet, startHeight)
  } catch (error) {
    if (!isAlreadyRescanning(error)) {
      throw error
    }
    await waitForRescanStopped(coreWallet, isCancelled)
    await startRescan(coreWallet, startHeight).catch((retryError: unknown) => {
      if (!isAlreadyRescanning(retryError)) {
        throw retryError
      }
    })
  }
}

/**
 * Map Core's 0–1 scan fraction back to an approximate block height across the
 * scanned range. A bare `true` (seen on some Core versions) maps to start.
 */
function scanProgressHeight(
  scanning: CoreWalletInfo['scanning'],
  startHeight: number,
  tipHeight: number
): number {
  if (scanning === false) {
    return tipHeight
  }
  if (scanning === true) {
    return startHeight
  }
  if (tipHeight <= startHeight) {
    return tipHeight
  }
  return Math.round(startHeight + scanning.progress * (tipHeight - startHeight))
}

/**
 * Poll getwalletinfo until Core finishes scanning (max ~6 hours). Aborts the
 * Core rescan on cancel so a restarted sync can begin at a new height.
 */
async function pollRescan(
  coreWallet: BitcoinCoreWallet,
  onPoll: (info: CoreWalletInfo) => void,
  isCancelled?: () => boolean
) {
  let consecutiveErrors = 0

  for (let i = 0; i < BDK_RESCAN_MAX_POLLS; i += 1) {
    if (isCancelled?.()) {
      await coreWallet.abortRescan().catch(() => undefined)
      throw new Error(SYNC_CANCELLED_ERROR)
    }
    try {
      const info = await coreWallet.getWalletInfo()
      consecutiveErrors = 0
      onPoll(info)
      if (info.scanning === false) {
        return
      }
    } catch (error) {
      consecutiveErrors += 1
      if (consecutiveErrors >= BDK_RESCAN_POLL_MAX_CONSECUTIVE_ERRORS) {
        const msg = error instanceof Error ? error.message : String(error)
        throw new Error(
          `Lost connection during rescan after ${consecutiveErrors} retries: ${msg}`,
          { cause: error }
        )
      }
    }
    await sleep(BDK_RESCAN_POLL_INTERVAL_MS)
  }
}

/** Rescan the chain from the resolved start height, reporting progress. */
async function rescanWallet(
  coreWallet: BitcoinCoreWallet,
  account: Account,
  wallet: BdkWallet,
  onProgress?: CoreWalletSyncProgress,
  isCancelled?: () => boolean,
  rpcScanFromHeight?: number
) {
  const tipHeight = await coreWallet.getBlockCount()
  const startHeight = resolveStartHeight(
    account,
    wallet,
    tipHeight,
    rpcScanFromHeight
  )
  // Fall back to wall clock for date estimates
  const tipMediantime = await coreWallet
    .getBlockchainInfo()
    .then((info) => info.mediantime)
    .catch(() => Math.floor(Date.now() / 1000))

  const estimateBlockTimeSec = (height: number) =>
    tipMediantime - Math.max(0, tipHeight - height) * BDK_SECONDS_PER_BLOCK
  const scanFromTimeSec =
    toUnixSec(account.birthdayDate) ?? estimateBlockTimeSec(startHeight)
  const emitProgress = (currentHeight: number, transactionsFound?: number) => {
    onProgress?.(currentHeight, tipHeight, {
      currentBlockTimeSec: estimateBlockTimeSec(currentHeight),
      scanFromTimeSec,
      transactionsFound
    })
  }

  await waitForRescanStopped(coreWallet, isCancelled)
  emitProgress(startHeight)
  await startRescanFrom(coreWallet, startHeight, isCancelled)
  await pollRescan(
    coreWallet,
    (info) => {
      emitProgress(
        scanProgressHeight(info.scanning, startHeight, tipHeight),
        info.txcount
      )
    },
    isCancelled
  )
  emitProgress(tipHeight)
}

/** Stored account transactions as list entries, for incremental merges. */
function accountTxsAsEntries(account: Account): WalletTxEntry[] {
  return account.transactions.map((tx) => ({
    amount:
      tx.type === 'receive'
        ? tx.received / SATS_PER_BITCOIN
        : -(tx.sent / SATS_PER_BITCOIN),
    blockheight: tx.blockHeight,
    blocktime: toUnixSec(tx.timestamp),
    category: tx.type,
    time: toUnixSec(tx.timestamp) ?? 0,
    txid: tx.id
  }))
}

/**
 * Aggregate per-output wallet entries into per-tx sent/received sats.
 * Txids Core reports as removed (re-orged out) are dropped; still-valid ones
 * reappear on the next sync.
 */
function summarizeWalletTxs(
  entries: WalletTxEntry[],
  removedTxids: string[] = []
): Map<string, WalletTxSummary> {
  const txMap = new Map<string, WalletTxSummary>()

  for (const entry of entries) {
    const amtSat = btcToSats(Math.abs(entry.amount))
    const existing = txMap.get(entry.txid)
    if (!existing) {
      txMap.set(entry.txid, {
        blockheight: entry.blockheight,
        blocktime: entry.blocktime,
        received: entry.category === 'receive' ? amtSat : 0,
        sent: entry.category === 'send' ? amtSat : 0
      })
    } else if (entry.category === 'receive') {
      existing.received += amtSat
    } else if (entry.category === 'send') {
      existing.sent += amtSat
    }
  }

  for (const txid of removedTxids) {
    txMap.delete(txid)
  }
  return txMap
}

/** Build an app transaction; without decoded details only the summary is used. */
function toAppTransaction(
  txid: string,
  summary: WalletTxSummary,
  decoded?: CoreTxDetails
): Transaction {
  const d = decoded?.decoded
  const raw = decoded?.hex ? hexToBytes(decoded.hex) : []
  const vin: Transaction['vin'] = (d?.vin ?? []).map((v) => ({
    previousOutput: { txid: v.txid ?? '', vout: v.vout ?? 0 },
    scriptSig: [],
    sequence: v.sequence,
    witness: (v.txinwitness ?? []).map(hexToBytes)
  }))
  const vout: Transaction['vout'] = (d?.vout ?? []).map((o) => ({
    address: o.scriptPubKey.address ?? o.scriptPubKey.addresses?.[0] ?? '',
    script: hexToBytes(o.scriptPubKey.hex),
    value: btcToSats(o.value)
  }))
  const blocktime = decoded ? decoded.blocktime : summary.blocktime
  const lockTime = d?.locktime ?? 0

  return {
    address: vout.find((o) => o.address)?.address ?? '',
    blockHeight: decoded?.blockheight ?? summary.blockheight,
    fee:
      decoded?.fee !== undefined ? Math.abs(btcToSats(decoded.fee)) : undefined,
    id: txid,
    label: '',
    lockTime,
    lockTimeEnabled: lockTime > 0,
    prices: {},
    raw,
    received: summary.received,
    sent: summary.sent,
    size: raw.length || undefined,
    timestamp: blocktime ? new Date(blocktime * 1000) : undefined,
    type: summary.sent > 0 ? 'send' : 'receive',
    version: d?.version,
    vin,
    vout,
    vsize: d?.vsize,
    weight: d?.weight
  }
}

/** Peek keychain addresses until `stopGap` past the last used one. */
function peekKeychainAddresses(
  wallet: BdkWallet,
  keychain: 'external' | 'internal',
  usedAddresses: Set<string>,
  stopGap: number,
  network: AppNetwork
): Account['addresses'] {
  const kind =
    keychain === 'external' ? KeychainKind.External : KeychainKind.Internal
  const addresses: Account['addresses'] = []
  let lastUsed = -1

  for (let i = 0; i < stopGap * 2; i += 1) {
    const { address } = wallet.peekAddress(kind, i)
    if (usedAddresses.has(address)) {
      lastUsed = i
    }
    addresses.push({
      address,
      index: i,
      keychain,
      label: '',
      network,
      summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
      transactions: [],
      utxos: []
    })
    if (i >= lastUsed + stopGap) {
      break
    }
  }
  return addresses
}

/**
 * Sync a wallet via Bitcoin Core's descriptor wallet (importdescriptors path).
 * Does NOT require blockfilterindex=1 and is faster than compact filters for
 * wallets with a known birthday.
 *
 * Flow:
 *  1. Ensure a watch-only descriptor wallet exists (named via rpcWalletName, or
 *     defaulting to `satsigner-{fingerprint}`)
 *  2. Import descriptors (first call only)
 *  3. Rescan from the resolved start height and wait for Core to finish
 *  4. Fetch transactions + UTXOs and map to app types
 */
async function syncWithCoreWallet(
  account: Account,
  wallet: BdkWallet,
  nodeUrl: string,
  credentials: RpcCredentials,
  bdkNetwork: Network,
  stopGap: number,
  onProgress?: CoreWalletSyncProgress,
  isCancelled?: () => boolean,
  rpcWalletName?: string,
  rpcScanFromHeight?: number
): Promise<
  Pick<Account, 'transactions' | 'utxos' | 'addresses' | 'summary'> & {
    rpcLastBlockHash: string
  }
> {
  const coreWallet = new BitcoinCoreWallet(
    nodeUrl,
    credentials.username,
    credentials.password,
    resolveRpcWalletName(account, rpcWalletName)
  )
  await coreWallet.ensureWallet()

  const normalized = await coreWallet.normalizeDescriptors(
    ...toSinglePathDescriptors(
      ...getWalletPublicDescriptors(account, wallet, bdkNetwork)
    )
  )
  const needsRescan = await importDescriptorsIfNeeded(
    coreWallet,
    account,
    normalized,
    stopGap
  )
  if (needsRescan) {
    await rescanWallet(
      coreWallet,
      account,
      wallet,
      onProgress,
      isCancelled,
      rpcScanFromHeight
    )
  }

  const priorHash = account.rpcLastBlockHash ?? ''
  const isIncremental = priorHash.length === 64
  const [sinceResult, unspent, listedDescriptors] = await Promise.all([
    coreWallet.listSinceBlock(priorHash),
    coreWallet.listUnspent(),
    coreWallet.listDescriptors().catch(() => ({ descriptors: [] }))
  ])
  const coreMaxExternal = maxCoreKeychainIndex(
    listedDescriptors.descriptors,
    false
  )
  const coreMaxInternal = maxCoreKeychainIndex(
    listedDescriptors.descriptors,
    true
  )

  // Populate BDK's wallet DB with current UTXOs so buildTransaction / sign
  // can locate outpoints without a BDK (compact filter) sync.
  for (const u of unspent) {
    if (!u.scriptPubKey) {
      continue
    }
    try {
      wallet.insertTxout(
        { txid: u.txid, vout: u.vout },
        { scriptPubkeyHex: u.scriptPubKey, value: btcToSats(u.amount) }
      )
    } catch {
      // non-critical — BDK may already know this outpoint
    }
  }

  const txSummaries = summarizeWalletTxs(
    isIncremental
      ? [...sinceResult.transactions, ...accountTxsAsEntries(account)]
      : sinceResult.transactions,
    (sinceResult.removed ?? []).map((entry) => entry.txid)
  )
  const transactions = await Promise.all(
    [...txSummaries].map(async ([txid, summary]) =>
      toAppTransaction(
        txid,
        summary,
        await coreWallet.getTransaction(txid).catch(() => undefined)
      )
    )
  )
  // Newest first, unconfirmed on top
  transactions.sort(
    (a, b) => (b.blockHeight ?? Infinity) - (a.blockHeight ?? Infinity)
  )

  const utxos: Utxo[] = unspent.map((u) => ({
    addressTo: u.address,
    keychain: 'external',
    script: u.scriptPubKey ? hexToBytes(u.scriptPubKey) : undefined,
    timestamp: undefined,
    txid: u.txid,
    value: btcToSats(u.amount),
    vout: u.vout
  }))

  const appNetwork = toAppNetwork(bdkNetwork)
  const usedAddresses = new Set([
    ...transactions.flatMap((tx) => tx.vout.map((o) => o.address)),
    ...utxos.map((u) => u.addressTo ?? '')
  ])
  const peeked = [
    ...peekKeychainAddresses(
      wallet,
      'external',
      usedAddresses,
      stopGap,
      appNetwork
    ),
    ...peekKeychainAddresses(
      wallet,
      'internal',
      usedAddresses,
      stopGap,
      appNetwork
    )
  ]
  const addresses = ensureAddressesIncludeSeenOutputs(
    wallet,
    appNetwork,
    appendAddressAtIndex(
      wallet,
      appendAddressAtIndex(
        wallet,
        peeked,
        'external',
        coreMaxExternal,
        appNetwork
      ),
      'internal',
      coreMaxInternal,
      appNetwork
    ),
    collectTransactionOutputAddresses(transactions),
    ownershipScanLimit(Math.max(coreMaxExternal, coreMaxInternal))
  )

  revealKnownAddresses(wallet, { addresses }, stopGap, {
    external: coreMaxExternal,
    internal: coreMaxInternal
  })

  const ownedTransactions = annotateTransactionsWithWalletOwnership(
    transactions,
    addresses,
    utxos
  )
  const confirmedTxids = new Set(
    ownedTransactions
      .filter((tx) => (tx.blockHeight ?? 0) > 0)
      .map((tx) => tx.id)
  )
  const sumValues = (list: Utxo[]) => list.reduce((sum, u) => sum + u.value, 0)

  return {
    addresses,
    rpcLastBlockHash: sinceResult.lastblock,
    summary: {
      balance: sumValues(utxos.filter((u) => confirmedTxids.has(u.txid))),
      numberOfAddresses: addresses.filter(
        (a) => a.keychain === 'external' && usedAddresses.has(a.address)
      ).length,
      numberOfTransactions: ownedTransactions.length,
      numberOfUtxos: utxos.length,
      satsInMempool: sumValues(utxos.filter((u) => !confirmedTxids.has(u.txid)))
    },
    transactions: ownedTransactions,
    utxos
  }
}

export {
  scanProgressHeight,
  startRescan,
  summarizeWalletTxs,
  syncWithCoreWallet,
  toSinglePathDescriptors
}
