import {
  ECASH_MINT_QUOTE_EXPIRY_GRACE_MS,
  ECASH_PENDING_MINT_FAST_POLL_WINDOW_MS,
  ECASH_PENDING_MINT_MAX_AGE_MS,
  ECASH_PENDING_MINT_SLOW_POLL_INTERVAL_MS,
  ECASH_QUOTE_POLL_INTERVAL_MS
} from '@/constants/ecash'
import { MS_PER_SECOND } from '@/constants/time'
import type { EcashTransaction, MintQuoteState } from '@/types/models/Ecash'
import { assertNever } from '@/utils/assertNever'

/** A Lightning invoice for minting ecash that has not settled yet. */
type PendingMint = {
  accountId: string
  amount: number
  createdAt: number
  /** After this time an unpaid quote counts as expired. */
  deadline: number
  mintUrl: string
  quoteId: string
  transactionId: string
}

/**
 * What to do with a pending mint after asking its mint. A quote stays
 * `PENDING` while a payment is in flight, so only `UNPAID` can run out.
 * `ISSUED` on a pending transaction means the proofs went to another wallet.
 */
type PendingMintStep = 'wait' | 'mint' | 'expire' | 'fail'

/** How a mint invoice looks to the person who created it. */
type MintInvoiceStatus = 'waiting' | 'received' | 'expired' | 'failed'

type PendingMintSource = {
  accounts: { id: string }[]
  transactions: Record<string, EcashTransaction[]>
}

function toPendingMintStep(
  state: MintQuoteState,
  deadline: number,
  now: number
): PendingMintStep {
  switch (state) {
    case 'PENDING': {
      return 'wait'
    }
    case 'UNPAID': {
      return now > deadline ? 'expire' : 'wait'
    }
    case 'PAID': {
      return 'mint'
    }
    case 'EXPIRED': {
      return 'expire'
    }
    case 'ISSUED':
    case 'CANCELLED': {
      return 'fail'
    }
    default: {
      return assertNever(state)
    }
  }
}

function toPendingMint(
  accountId: string,
  transaction: EcashTransaction
): PendingMint | undefined {
  const { quoteId } = transaction
  if (transaction.type !== 'mint' || transaction.status !== 'pending') {
    return undefined
  }
  if (!quoteId) {
    return undefined
  }
  const createdAt = Date.parse(transaction.timestamp)
  const deadline = transaction.expiry
    ? transaction.expiry * MS_PER_SECOND + ECASH_MINT_QUOTE_EXPIRY_GRACE_MS
    : createdAt + ECASH_PENDING_MINT_MAX_AGE_MS
  return {
    accountId,
    amount: transaction.amount,
    createdAt,
    deadline,
    mintUrl: transaction.mintUrl,
    quoteId,
    transactionId: transaction.id
  }
}

function listPendingMints({
  accounts,
  transactions
}: PendingMintSource): PendingMint[] {
  return accounts.flatMap(({ id }) =>
    (transactions[id] ?? []).flatMap(
      (transaction) => toPendingMint(id, transaction) ?? []
    )
  )
}

function hasPendingMints(source: PendingMintSource): boolean {
  return listPendingMints(source).length > 0
}

/** Polls fast while any invoice is fresh, slower after, and not at all when none is pending. */
function pendingMintPollInterval(
  pendingMints: PendingMint[],
  now: number
): number | false {
  if (pendingMints.length === 0) {
    return false
  }
  const hasFreshInvoice = pendingMints.some(
    ({ createdAt }) => now - createdAt < ECASH_PENDING_MINT_FAST_POLL_WINDOW_MS
  )
  return hasFreshInvoice
    ? ECASH_QUOTE_POLL_INTERVAL_MS
    : ECASH_PENDING_MINT_SLOW_POLL_INTERVAL_MS
}

function toMintInvoiceStatus(
  status: EcashTransaction['status']
): MintInvoiceStatus {
  switch (status) {
    case undefined:
    case 'pending': {
      return 'waiting'
    }
    case 'completed':
    case 'settled': {
      return 'received'
    }
    case 'expired': {
      return 'expired'
    }
    case 'failed': {
      return 'failed'
    }
    default: {
      return assertNever(status)
    }
  }
}

export {
  hasPendingMints,
  listPendingMints,
  type MintInvoiceStatus,
  type PendingMint,
  pendingMintPollInterval,
  type PendingMintStep,
  toMintInvoiceStatus,
  toPendingMintStep
}
