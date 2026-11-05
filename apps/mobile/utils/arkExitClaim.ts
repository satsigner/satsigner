import { ARK_EXIT_CLAIM_MAX_FEE_RATE_MULTIPLIER } from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { type ArkExitClaimDraft } from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'
import { bytesEqual } from '@/utils/byteArray'
import {
  inputOutpoint,
  outputScriptFor,
  parsePsbt,
  parseTransaction,
  type Prevout,
  prevoutForInput,
  unsignedTxid
} from '@/utils/psbtInspection'

type ArkExitClaimRejection =
  | 'belowDust'
  | 'feeMismatch'
  | 'feeTooHigh'
  | 'inputAmountMismatch'
  | 'invalidAddress'
  | 'invalidPsbt'
  | 'invalidSignedTx'
  | 'missingPrevout'
  | 'txidMismatch'
  | 'unexpectedInputs'
  | 'unexpectedOutputs'

type VerifiedArkExitClaim = {
  txid: string
  amountSats: number
  feeSats: number
  vtxoIds: string[]
}

type ArkExitClaimCheck<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: ArkExitClaimRejection }

type VerifyArkExitClaimDraftParams = {
  draft: ArkExitClaimDraft
  requestedVtxoIds: string[]
  address: string
  network: Network
  // Amounts the wallet reports for the exiting VTXOs, by id. Each input that
  // has one must spend exactly that much.
  knownAmounts: ReadonlyMap<string, number>
}

type VerifyArkExitClaimSignedTxParams = {
  claim: VerifiedArkExitClaim
  signedTxHex: string
  feeRateSatPerVb: number
}

function reject(reason: ArkExitClaimRejection): {
  ok: false
  reason: ArkExitClaimRejection
} {
  return { ok: false, reason }
}

function hasSameMembers(left: string[], right: string[]): boolean {
  const rightSet = new Set(right)
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    left.every((item) => rightSet.has(item))
  )
}

function sumPrevoutSats(prevouts: Prevout[]): bigint {
  return prevouts.reduce((total, prevout) => total + prevout.value, 0n)
}

function spendsKnownAmounts(
  vtxoIds: string[],
  prevouts: Prevout[],
  knownAmounts: ReadonlyMap<string, number>
): boolean {
  return vtxoIds.every((vtxoId, index) => {
    const amountSats = knownAmounts.get(vtxoId)
    return (
      amountSats === undefined || prevouts[index].value === BigInt(amountSats)
    )
  })
}

/**
 * Checks a claim built by the wallet before it is signed: it may only spend
 * the exits that were asked for, and must pay everything but the stated fee
 * to the one chosen address.
 */
function verifyArkExitClaimDraft({
  draft,
  requestedVtxoIds,
  address,
  network,
  knownAmounts
}: VerifyArkExitClaimDraftParams): ArkExitClaimCheck<VerifiedArkExitClaim> {
  const psbt = parsePsbt(draft.psbtBase64)
  if (!psbt) {
    return reject('invalidPsbt')
  }
  const destinationScript = outputScriptFor(address, network)
  if (!destinationScript) {
    return reject('invalidAddress')
  }

  const spentVtxoIds = psbt.txInputs.map(inputOutpoint)
  const requested = new Set(requestedVtxoIds)
  if (
    spentVtxoIds.length === 0 ||
    !hasSameMembers(spentVtxoIds, draft.vtxoIds) ||
    !spentVtxoIds.every((vtxoId) => requested.has(vtxoId))
  ) {
    return reject('unexpectedInputs')
  }

  const [output, ...extraOutputs] = psbt.txOutputs
  if (
    !output ||
    extraOutputs.length > 0 ||
    !bytesEqual(output.script, destinationScript)
  ) {
    return reject('unexpectedOutputs')
  }

  const prevouts = spentVtxoIds.map((_, index) => prevoutForInput(psbt, index))
  const knownPrevouts = prevouts.filter(
    (prevout): prevout is Prevout => prevout !== undefined
  )
  if (knownPrevouts.length !== prevouts.length) {
    return reject('missingPrevout')
  }
  if (!spendsKnownAmounts(spentVtxoIds, knownPrevouts, knownAmounts)) {
    return reject('inputAmountMismatch')
  }

  const feeSats = sumPrevoutSats(knownPrevouts) - output.value
  if (feeSats < 0n || feeSats !== BigInt(draft.feeSats)) {
    return reject('feeMismatch')
  }
  if (output.value < BigInt(DUST_LIMIT)) {
    return reject('belowDust')
  }

  return {
    amountSats: Number(output.value),
    feeSats: Number(feeSats),
    ok: true,
    txid: unsignedTxid(psbt),
    vtxoIds: spentVtxoIds
  }
}

function maxArkExitClaimFeeSats(
  vsize: number,
  feeRateSatPerVb: number
): number {
  return Math.ceil(
    vsize * feeRateSatPerVb * ARK_EXIT_CLAIM_MAX_FEE_RATE_MULTIPLIER
  )
}

/**
 * Checks the signed claim is the verified draft and, now its real size is
 * known, that the fee is in line with the rate the user picked.
 */
function verifyArkExitClaimSignedTx({
  claim,
  signedTxHex,
  feeRateSatPerVb
}: VerifyArkExitClaimSignedTxParams): ArkExitClaimCheck<{ txid: string }> {
  const signedTx = parseTransaction(signedTxHex)
  if (!signedTx) {
    return reject('invalidSignedTx')
  }
  if (signedTx.getId() !== claim.txid) {
    return reject('txidMismatch')
  }
  const maxFeeSats = maxArkExitClaimFeeSats(
    signedTx.virtualSize(),
    feeRateSatPerVb
  )
  if (claim.feeSats > maxFeeSats) {
    return reject('feeTooHigh')
  }
  return { ok: true, txid: claim.txid }
}

export {
  type ArkExitClaimRejection,
  type VerifiedArkExitClaim,
  verifyArkExitClaimDraft,
  verifyArkExitClaimSignedTx
}
