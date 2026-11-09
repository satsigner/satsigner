import { MeltQuoteState } from '@cashu/cashu-ts'

import type {
  EcashMeltResult,
  EcashProof,
  EcashTransaction
} from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'
import { proofsAfterMelt } from '@/utils/ecashProofs'

type EcashMeltStatus = EcashMeltResult['status']

/** A Lightning payment from ecash that the mint has not settled yet. */
type PendingMelt = {
  accountId: string
  mintUrl: string
  quoteId: string
  reservedProofs: EcashProof[]
  transactionId: string
}

type PendingMeltSource = {
  accounts: { id: string }[]
  transactions: Record<string, EcashTransaction[]>
}

/**
 * The mint answers a melt with the quote state instead of throwing, so only
 * `PAID` means the Lightning payment went through.
 */
function toEcashMeltStatus(state: MeltQuoteState): EcashMeltStatus {
  switch (state) {
    case MeltQuoteState.PAID: {
      return 'paid'
    }
    case MeltQuoteState.PENDING: {
      return 'pending'
    }
    case MeltQuoteState.UNPAID: {
      return 'unpaid'
    }
    default: {
      return assertNever(state)
    }
  }
}

/**
 * The account's proofs after a melt. An unpaid melt releases `send` at the
 * mint. A pending one leaves `send` out: it stays reserved on the melt
 * transaction until the payment settles or fails.
 */
function proofsAfterMeltResult(
  allProofs: EcashProof[],
  meltedProofs: EcashProof[],
  result: EcashMeltResult
): EcashProof[] {
  return proofsAfterMelt(
    allProofs,
    meltedProofs,
    result.keep,
    returnedProofs(result)
  )
}

function returnedProofs(result: EcashMeltResult): EcashProof[] {
  switch (result.status) {
    case 'paid': {
      return result.change
    }
    case 'unpaid': {
      return result.send
    }
    case 'pending': {
      return []
    }
    default: {
      return assertNever(result)
    }
  }
}

function toPendingMelt(
  accountId: string,
  { id, mintUrl, quoteId, reservedProofs, status, type }: EcashTransaction
): PendingMelt | undefined {
  if (type !== 'melt' || status !== 'pending' || !quoteId) {
    return undefined
  }
  return {
    accountId,
    mintUrl,
    quoteId,
    reservedProofs: reservedProofs ?? [],
    transactionId: id
  }
}

function listPendingMelts({
  accounts,
  transactions
}: PendingMeltSource): PendingMelt[] {
  return accounts.flatMap(({ id }) =>
    (transactions[id] ?? []).flatMap(
      (transaction) => toPendingMelt(id, transaction) ?? []
    )
  )
}

function hasPendingMelts(source: PendingMeltSource): boolean {
  return listPendingMelts(source).length > 0
}

export {
  hasPendingMelts,
  listPendingMelts,
  type PendingMelt,
  proofsAfterMeltResult,
  toEcashMeltStatus
}
