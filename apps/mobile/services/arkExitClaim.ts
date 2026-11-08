import {
  buildArkExitClaim,
  listArkExits,
  signArkExitClaim,
  syncArkExits
} from '@/api/ark'
import { broadcastRawTransaction } from '@/api/broadcast'
import { fetchTransactionOutspends } from '@/api/transactionOutspends'
import { t } from '@/locales'
import {
  peekFreshReceiveAddress,
  reserveFreshReceiveAddress
} from '@/services/accountReceiveAddress'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import { useAccountsStore } from '@/store/accounts'
import { getArkAccountOrThrow } from '@/store/ark'
import {
  getArkAccountExitClaims,
  getArkExitClaimRecord,
  useArkExitClaimsStore
} from '@/store/arkExitClaims'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import {
  type ArkAccount,
  type ArkExit,
  type ArkExitClaimRecord
} from '@/types/models/Ark'
import { getArkExitClaimBlocker, getClaimableArkExits } from '@/utils/arkExit'
import {
  type ArkExitClaimTerms,
  matchesApprovedArkExitClaim,
  type VerifiedArkExitClaim,
  verifyArkExitClaimDraft,
  verifyArkExitClaimSignedTx
} from '@/utils/arkExitClaim'
import {
  canAccountReceiveArkSweep,
  isValidArkOnchainFeeRate
} from '@/utils/arkOnchainSweep'
import { parseOutpoint } from '@/utils/outpoint'

type ArkExitClaimRequest = {
  arkAccountId: string
  destinationAccountId: string
  feeRateSatPerVb: number
}

type ArkExitClaimPreview = ArkExitClaimTerms & {
  skippedCount: number
}

type ArkExitClaimSubmission = ArkExitClaimRequest & {
  // What the user saw and approved. A claim that no longer matches it is
  // refused before signing.
  approved: ArkExitClaimTerms
}

type ArkExitClaimResult = {
  txid: string
  amountSats: number
  destinationName: string
}

// Ark accounts with a claim being built, signed or broadcast right now. Two
// overlapping claims would both pass the in-progress check before either is
// saved.
const claimsInFlight = new Set<string>()

function resolveClaimRequest({
  arkAccountId,
  destinationAccountId,
  feeRateSatPerVb
}: ArkExitClaimRequest): { arkAccount: ArkAccount; destination: Account } {
  if (
    !Number.isSafeInteger(feeRateSatPerVb) ||
    !isValidArkOnchainFeeRate(feeRateSatPerVb)
  ) {
    throw new Error(t('ark.exit.claim.error.invalidFeeRate'))
  }
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  const destination = useAccountsStore
    .getState()
    .accounts.find((account) => account.id === destinationAccountId)
  if (
    !destination ||
    !canAccountReceiveArkSweep(destination, arkAccount.network)
  ) {
    throw new Error(t('ark.exit.claim.error.ineligible'))
  }
  return { arkAccount, destination }
}

/**
 * Reads the account's exits from the wallet and drops kept claims the wallet
 * has since seen settle.
 */
async function refreshArkExits(arkAccountId: string): Promise<ArkExit[]> {
  const { serverId } = getArkAccountOrThrow(arkAccountId)
  await ensureArkWalletOpen(arkAccountId)
  await syncArkExits(serverId, arkAccountId)
  const exits = await listArkExits(serverId, arkAccountId)
  useArkExitClaimsStore.getState().pruneAccountClaims(arkAccountId, exits)
  return exits
}

async function draftVerifiedClaim(
  arkAccount: ArkAccount,
  exits: ArkExit[],
  address: string,
  feeRateSatPerVb: number
): Promise<VerifiedArkExitClaim & { skippedCount: number; psbt: string }> {
  const claimable = getClaimableArkExits(exits)
  const requestedVtxoIds = claimable.map((exit) => exit.vtxoId)
  const draft = await buildArkExitClaim(
    arkAccount.serverId,
    arkAccount.id,
    requestedVtxoIds,
    address,
    feeRateSatPerVb
  )
  const knownAmounts = new Map(
    claimable.flatMap((exit) =>
      exit.amountSats === undefined ? [] : [[exit.vtxoId, exit.amountSats]]
    )
  )
  const verified = verifyArkExitClaimDraft({
    address,
    draft,
    knownAmounts,
    network: arkAccount.network,
    requestedVtxoIds
  })
  if (!verified.ok) {
    throw new Error(t(`ark.exit.claim.rejection.${verified.reason}`))
  }
  return {
    ...verified,
    psbt: draft.psbtBase64,
    skippedCount: draft.skippedVtxoIds.length
  }
}

function assertCanClaim(arkAccountId: string, exits: ArkExit[]): void {
  const blocker = getArkExitClaimBlocker({
    exits,
    hasDestination: true,
    pendingClaims: getArkAccountExitClaims(arkAccountId)
  })
  if (blocker) {
    throw new Error(t(`ark.exit.claim.blocker.${blocker}`))
  }
}

async function previewArkExitClaim(
  request: ArkExitClaimRequest
): Promise<ArkExitClaimPreview> {
  const { arkAccount, destination } = resolveClaimRequest(request)
  const exits = await refreshArkExits(arkAccount.id)
  assertCanClaim(arkAccount.id, exits)
  const address = await peekFreshReceiveAddress(destination)
  const claim = await draftVerifiedClaim(
    arkAccount,
    exits,
    address,
    request.feeRateSatPerVb
  )
  return {
    amountSats: claim.amountSats,
    feeSats: claim.feeSats,
    skippedCount: claim.skippedCount,
    vtxoIds: claim.vtxoIds
  }
}

function getClaimServer(record: ArkExitClaimRecord) {
  const { network } = getArkAccountOrThrow(record.arkAccountId)
  return {
    network,
    server: useBlockchainStore.getState().configs[network].server
  }
}

async function broadcastClaimRecord(record: ArkExitClaimRecord): Promise<void> {
  const { network, server } = getClaimServer(record)
  const claims = useArkExitClaimsStore.getState()
  claims.saveClaim({ ...record, broadcastStatus: 'broadcasting' })
  try {
    await broadcastRawTransaction(record.txHex, server, network)
  } catch (error) {
    claims.updateClaimStatus(record.txid, 'failed')
    throw error
  }
  claims.updateClaimStatus(record.txid, 'broadcast')
}

async function withClaimLock<T>(
  arkAccountId: string,
  run: () => Promise<T>
): Promise<T> {
  if (claimsInFlight.has(arkAccountId)) {
    throw new Error(t('ark.exit.claim.blocker.claimInProgress'))
  }
  claimsInFlight.add(arkAccountId)
  try {
    return await run()
  } finally {
    claimsInFlight.delete(arkAccountId)
  }
}

async function buildSignAndBroadcastClaim({
  approved,
  ...request
}: ArkExitClaimSubmission): Promise<ArkExitClaimResult> {
  const { arkAccount, destination } = resolveClaimRequest(request)
  const exits = await refreshArkExits(arkAccount.id)
  assertCanClaim(arkAccount.id, exits)

  // Reserved only once the claim is signed and verified, so a rejected
  // attempt does not use up an address.
  const address = await peekFreshReceiveAddress(destination)
  const claim = await draftVerifiedClaim(
    arkAccount,
    exits,
    address,
    request.feeRateSatPerVb
  )
  if (!matchesApprovedArkExitClaim(claim, approved)) {
    throw new Error(t('ark.exit.claim.error.changed'))
  }
  const txHex = await signArkExitClaim(
    arkAccount.serverId,
    arkAccount.id,
    claim.psbt
  )
  const signed = verifyArkExitClaimSignedTx({
    claim,
    feeRateSatPerVb: request.feeRateSatPerVb,
    signedTxHex: txHex
  })
  if (!signed.ok) {
    throw new Error(t(`ark.exit.claim.rejection.${signed.reason}`))
  }
  // Another send may have taken the drafted address in the meantime.
  const reservedAddress = await reserveFreshReceiveAddress(destination)
  if (reservedAddress !== address) {
    throw new Error(t('ark.exit.claim.error.changed'))
  }

  // Kept before broadcasting, so after a crash the app can only ever resend
  // this exact transaction, never build a different claim of the same exits.
  const record: ArkExitClaimRecord = {
    amountSats: claim.amountSats,
    arkAccountId: arkAccount.id,
    broadcastStatus: 'broadcasting',
    createdAt: new Date().toISOString(),
    destinationAccountId: destination.id,
    feeSats: claim.feeSats,
    inputAddresses: claim.inputAddresses,
    txHex,
    txid: claim.txid,
    vtxoIds: claim.vtxoIds
  }
  await broadcastClaimRecord(record)
  return {
    amountSats: claim.amountSats,
    destinationName: destination.name,
    txid: claim.txid
  }
}

/**
 * Claims every claimable exit of the account to a fresh receive address of
 * one of the user's wallets, exactly as the user approved it in the preview.
 */
function claimArkExits(
  submission: ArkExitClaimSubmission
): Promise<ArkExitClaimResult> {
  return withClaimLock(submission.arkAccountId, () =>
    buildSignAndBroadcastClaim(submission)
  )
}

async function rebroadcastClaim(
  arkAccountId: string,
  txid: string
): Promise<void> {
  const record = getArkExitClaimRecord(txid)
  if (record?.arkAccountId !== arkAccountId) {
    return
  }
  await refreshArkExits(record.arkAccountId)
  const pending = getArkExitClaimRecord(txid)
  if (!pending) {
    return
  }
  await broadcastClaimRecord(pending)
}

/** Sends a kept claim again, unless the wallet has seen it settle meanwhile. */
function retryArkExitClaimBroadcast(
  arkAccountId: string,
  txid: string
): Promise<void> {
  return withClaimLock(arkAccountId, () => rebroadcastClaim(arkAccountId, txid))
}

async function isClaimInputUnspent(
  record: ArkExitClaimRecord,
  vtxoId: string
): Promise<boolean> {
  const outpoint = parseOutpoint(vtxoId)
  const address = record.inputAddresses[vtxoId]
  if (!outpoint || !address) {
    return false
  }
  const { server } = getClaimServer(record)
  const outspends = await fetchTransactionOutspends(server, outpoint.txid, [
    { address, vout: outpoint.vout }
  ])
  return outspends.get(outpoint.vout)?.spent === false
}

async function areClaimInputsUnspent(
  record: ArkExitClaimRecord
): Promise<boolean> {
  const unspent = await Promise.all(
    record.vtxoIds.map((vtxoId) => isClaimInputUnspent(record, vtxoId))
  )
  return unspent.every(Boolean)
}

async function discardFailedClaim(
  arkAccountId: string,
  txid: string
): Promise<void> {
  // A broadcast reported as failed may still have reached the network. The
  // refresh drops the record once the wallet sees it spend the exits, and the
  // user's own server is asked too, as the wallet's chain source can lag.
  await refreshArkExits(arkAccountId)
  const record = getArkExitClaimRecord(txid)
  if (
    record?.arkAccountId !== arkAccountId ||
    record.broadcastStatus !== 'failed'
  ) {
    return
  }
  if (!(await areClaimInputsUnspent(record))) {
    throw new Error(t('ark.exit.claim.error.reachedNetwork'))
  }
  useArkExitClaimsStore.getState().removeClaim(txid)
}

/**
 * Forgets a claim that failed to broadcast so a new one can be built, once
 * the user's server confirms none of its exits were spent.
 */
function discardArkExitClaim(
  arkAccountId: string,
  txid: string
): Promise<void> {
  return withClaimLock(arkAccountId, () =>
    discardFailedClaim(arkAccountId, txid)
  )
}

export {
  type ArkExitClaimPreview,
  type ArkExitClaimRequest,
  type ArkExitClaimResult,
  type ArkExitClaimSubmission,
  claimArkExits,
  discardArkExitClaim,
  previewArkExitClaim,
  refreshArkExits,
  retryArkExitClaimBroadcast
}
