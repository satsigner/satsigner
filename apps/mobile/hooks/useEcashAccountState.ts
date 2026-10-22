import { useEcashStore } from '@/store/ecash'
import {
  activeAccountItems,
  activeAccountMintQuotes
} from '@/utils/ecashAccount'
import { uniqueProofsBySecret } from '@/utils/ecashProofs'

/**
 * Read-only ecash state for the active account. Screens that only display
 * balances, proofs or history use this instead of the full `useEcash`. Each
 * slice is selected for the active account only, so changes to other
 * accounts do not re-render the caller.
 */
export function useEcashAccountState() {
  const activeAccountId = useEcashStore((state) => state.activeAccountId)
  const activeAccount = useEcashStore(
    (state) =>
      state.accounts.find((a) => a.id === state.activeAccountId) ?? null
  )
  const mints = useEcashStore((state) =>
    activeAccountItems(state.mints, state.activeAccountId)
  )
  const rawProofs = useEcashStore((state) =>
    activeAccountItems(state.proofs, state.activeAccountId)
  )
  const transactions = useEcashStore((state) =>
    activeAccountItems(state.transactions, state.activeAccountId)
  )
  const counters = useEcashStore((state) =>
    activeAccountItems(state.counters, state.activeAccountId)
  )
  const mintQuotes = useEcashStore((state) =>
    activeAccountMintQuotes(state.quotes, state.activeAccountId)
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
