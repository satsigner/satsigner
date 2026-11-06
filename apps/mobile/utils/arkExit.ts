import { type Href } from 'expo-router'

import { ARK_VTXO_EXPIRY_WARNING_BLOCKS } from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import {
  type ArkExit,
  type ArkExitClaimRecord,
  type ArkExitStatus,
  type ArkOnchainFeeRates,
  type ArkVtxo
} from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'
import { getAccountTotalBalance } from '@/utils/account'
import { canAccountReceiveArkSweep } from '@/utils/arkOnchainSweep'

type ArkExitTone = 'progress' | 'ready' | 'done' | 'failed'

type ArkExitClaimFeeSpeed = 'slow' | 'regular' | 'fast'

type ArkExitClaimBlocker =
  | 'loading'
  | 'claimInProgress'
  | 'nothingClaimable'
  | 'noDestination'

const ARK_EXIT_TONES: Record<ArkExitStatus, ArkExitTone> = {
  alreadySpent: 'failed',
  awaitingDelta: 'progress',
  canceled: 'failed',
  claimInProgress: 'progress',
  claimable: 'ready',
  claimed: 'done',
  processing: 'progress',
  starting: 'progress',
  swept: 'failed'
}

// Lower sorts first: what the user can act on, then what is still moving,
// then finished exits.
const ARK_EXIT_SORT_RANK: Record<ArkExitTone, number> = {
  done: 3,
  failed: 2,
  progress: 1,
  ready: 0
}

const ARK_EXIT_TERMINAL_TONES: ReadonlySet<ArkExitTone> = new Set([
  'done',
  'failed'
])

// Until all exit transactions confirm, the Ark server can still sweep the
// VTXO once it expires.
const ARK_EXIT_UNCONFIRMED_STATUSES: ReadonlySet<ArkExitStatus> = new Set([
  'starting',
  'processing'
])

function getUnconfirmedArkExits(exits: ArkExit[]): ArkExit[] {
  return exits.filter((exit) => ARK_EXIT_UNCONFIRMED_STATUSES.has(exit.status))
}

const ARK_EXIT_CLAIM_FEE_RATE_FIELDS: Record<
  ArkExitClaimFeeSpeed,
  keyof ArkOnchainFeeRates
> = {
  fast: 'fastSatPerVb',
  regular: 'regularSatPerVb',
  slow: 'slowSatPerVb'
}

function getArkExitClaimFeeRate(
  rates: ArkOnchainFeeRates | undefined,
  speed: ArkExitClaimFeeSpeed
): number | undefined {
  return rates?.[ARK_EXIT_CLAIM_FEE_RATE_FIELDS[speed]]
}

function getArkExitTone(status: ArkExitStatus): ArkExitTone {
  return ARK_EXIT_TONES[status]
}

function isArkExitLive(exit: Pick<ArkExit, 'status'>): boolean {
  return !ARK_EXIT_TERMINAL_TONES.has(getArkExitTone(exit.status))
}

function sortArkExits(exits: ArkExit[]): ArkExit[] {
  return exits.toSorted(
    (left, right) =>
      ARK_EXIT_SORT_RANK[getArkExitTone(left.status)] -
      ARK_EXIT_SORT_RANK[getArkExitTone(right.status)]
  )
}

function getClaimableArkExits(exits: ArkExit[]): ArkExit[] {
  return exits.filter((exit) => exit.status === 'claimable')
}

function sumArkExitSats(exits: ArkExit[]): number {
  return exits.reduce((total, exit) => total + (exit.amountSats ?? 0), 0)
}

type ArkExitSummary = {
  claimableCount: number
  liveCount: number
  totalCount: number
}

function summarizeArkExits(exits: ArkExit[]): ArkExitSummary {
  return {
    claimableCount: getClaimableArkExits(exits).length,
    liveCount: exits.filter(isArkExitLive).length,
    totalCount: exits.length
  }
}

function getArkExitBlocksUntilClaimable(
  exit: Pick<ArkExit, 'claimableAtHeight' | 'status' | 'tipHeight'>
): number | undefined {
  if (exit.status !== 'awaitingDelta' || exit.claimableAtHeight === undefined) {
    return undefined
  }
  return Math.max(0, exit.claimableAtHeight - exit.tipHeight)
}

function getArkExitConfirmationRatio(
  exit: Pick<ArkExit, 'confirmedTxCount' | 'status' | 'totalTxCount'>
): number | undefined {
  if (
    exit.status !== 'processing' ||
    exit.confirmedTxCount === undefined ||
    !exit.totalTxCount
  ) {
    return undefined
  }
  return Math.min(1, exit.confirmedTxCount / exit.totalTxCount)
}

function isWithinExpiryWarning(expiryHeight: number, tipHeight: number) {
  return expiryHeight - tipHeight <= ARK_VTXO_EXPIRY_WARNING_BLOCKS
}

function countArkVtxosNearExpiry(
  vtxos: Pick<ArkVtxo, 'expiryHeight'>[],
  tipHeight: number | undefined
): number | undefined {
  if (tipHeight === undefined) {
    return undefined
  }
  return vtxos.filter((vtxo) =>
    isWithinExpiryWarning(vtxo.expiryHeight, tipHeight)
  ).length
}

/**
 * A kept claim is settled once the wallet no longer reports every one of its
 * exits as claimable: it has seen a claim spend them, or they are gone.
 */
function pruneArkExitClaimRecords(
  records: ArkExitClaimRecord[],
  accountId: string,
  exits: ArkExit[]
): ArkExitClaimRecord[] {
  const claimableIds = new Set(
    getClaimableArkExits(exits).map((exit) => exit.vtxoId)
  )
  return records.filter(
    (record) =>
      record.arkAccountId !== accountId ||
      record.vtxoIds.every((vtxoId) => claimableIds.has(vtxoId))
  )
}

function getArkExitClaimBlocker({
  exits,
  pendingClaims,
  hasDestination
}: {
  exits: ArkExit[] | undefined
  pendingClaims: ArkExitClaimRecord[]
  hasDestination: boolean
}): ArkExitClaimBlocker | undefined {
  if (!exits) {
    return 'loading'
  }
  const claimInProgress =
    pendingClaims.length > 0 ||
    exits.some((exit) => exit.status === 'claimInProgress')
  if (claimInProgress) {
    return 'claimInProgress'
  }
  if (getClaimableArkExits(exits).length === 0) {
    return 'nothingClaimable'
  }
  if (!hasDestination) {
    return 'noDestination'
  }
}

type ArkExitFundingBalance = {
  exitBroadcastFeeSats: number
  onchainConfirmedSats: number
  onchainPendingSats: number
}

/** What still has to be sent to the on-chain wallet, counting incoming funds. */
function getArkExitFundingShortfall({
  exitBroadcastFeeSats,
  onchainConfirmedSats,
  onchainPendingSats
}: ArkExitFundingBalance): number {
  return Math.max(
    0,
    exitBroadcastFeeSats - onchainConfirmedSats - onchainPendingSats
  )
}

/** Incoming funds cover the exit fees but have not confirmed yet. */
function isArkExitFundingConfirming(balance: ArkExitFundingBalance): boolean {
  return (
    balance.onchainConfirmedSats < balance.exitBroadcastFeeSats &&
    getArkExitFundingShortfall(balance) === 0
  )
}

function getArkExitFundingAmount(shortfallSats: number): number {
  return Math.max(shortfallSats, DUST_LIMIT)
}

/** Wallets on the network that hold coins to top up the exit fee wallet. */
function getArkExitFundingSources<
  T extends Pick<Account, 'keys' | 'network' | 'summary'>
>(accounts: T[], network: Network): T[] {
  return accounts
    .filter(
      (account) =>
        canAccountReceiveArkSweep(account, network) &&
        getAccountTotalBalance(account.summary) > 0
    )
    .toSorted(
      (left, right) =>
        getAccountTotalBalance(right.summary) -
        getAccountTotalBalance(left.summary)
    )
}

function getNewlyClaimableArkExitIds(
  exits: ArkExit[],
  announcedIds: string[]
): string[] {
  const announced = new Set(announcedIds)
  return getClaimableArkExits(exits)
    .map((exit) => exit.vtxoId)
    .filter((vtxoId) => !announced.has(vtxoId))
}

function getArkExitsRoute(accountId: string): Href {
  return `/signer/ark/account/${accountId}/exits`
}

export {
  type ArkExitClaimBlocker,
  type ArkExitClaimFeeSpeed,
  type ArkExitSummary,
  type ArkExitTone,
  countArkVtxosNearExpiry,
  getArkExitBlocksUntilClaimable,
  getArkExitClaimBlocker,
  getArkExitClaimFeeRate,
  getArkExitConfirmationRatio,
  getArkExitFundingAmount,
  getArkExitFundingShortfall,
  isArkExitFundingConfirming,
  getArkExitFundingSources,
  getArkExitsRoute,
  getArkExitTone,
  getClaimableArkExits,
  getNewlyClaimableArkExitIds,
  getUnconfirmedArkExits,
  isArkExitLive,
  pruneArkExitClaimRecords,
  sortArkExits,
  sumArkExitSats,
  summarizeArkExits
}
