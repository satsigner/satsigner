import { useEcashStore } from '@/store/ecash'
import {
  activeAccountItems,
  activeAccountMintQuotes
} from '@/utils/ecashAccount'
import { uniqueProofsBySecret } from '@/utils/ecashProofs'

/**
 * Read-only ecash state for one account: the given one, or else the active
 * one. Screens that only display balances, proofs or history use this instead
 * of the full `useEcash`. Each slice is selected for that account only, so
 * changes to other accounts do not re-render the caller.
 */
export function useEcashAccountState(accountId?: string) {
  const storeActiveAccountId = useEcashStore((state) => state.activeAccountId)
  const activeAccountId = accountId ?? storeActiveAccountId
  const activeAccount = useEcashStore(
    (state) => state.accounts.find((a) => a.id === activeAccountId) ?? null
  )
  const mints = useEcashStore((state) =>
    activeAccountItems(state.mints, activeAccountId)
  )
  const rawProofs = useEcashStore((state) =>
    activeAccountItems(state.proofs, activeAccountId)
  )
  const transactions = useEcashStore((state) =>
    activeAccountItems(state.transactions, activeAccountId)
  )
  const counters = useEcashStore((state) =>
    activeAccountItems(state.counters, activeAccountId)
  )
  const mintQuotes = useEcashStore((state) =>
    activeAccountMintQuotes(state.quotes, activeAccountId)
  )

  return {
    activeAccount,
    activeAccountId,
    counters,
    mintQuotes,
    mints,
    proofs: uniqueProofsBySecret(rawProofs),
    transactions
  }
}
