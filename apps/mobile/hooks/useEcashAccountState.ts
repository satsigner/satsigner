import { useShallow } from 'zustand/react/shallow'

import { useEcashStore } from '@/store/ecash'

/**
 * Read-only ecash state for the active account. Screens that only display
 * balances, proofs or history use this instead of the full `useEcash`.
 */
export function useEcashAccountState() {
  const [
    accounts,
    activeAccountId,
    allMints,
    allProofs,
    allTransactions,
    allMintQuotes,
    allCounters
  ] = useEcashStore(
    useShallow((state) => [
      state.accounts,
      state.activeAccountId,
      state.mints,
      state.proofs,
      state.transactions,
      state.quotes,
      state.counters
    ])
  )

  const activeAccount = accounts.find((a) => a.id === activeAccountId) ?? null
  const mints = activeAccountId ? (allMints[activeAccountId] ?? []) : []
  const rawProofs = activeAccountId ? (allProofs[activeAccountId] ?? []) : []
  const proofs = rawProofs.filter(
    (proof, index, arr) =>
      arr.findIndex((p) => p.secret === proof.secret) === index
  )
  const transactions = activeAccountId
    ? (allTransactions[activeAccountId] ?? [])
    : []
  const mintQuotes = activeAccountId
    ? (allMintQuotes[activeAccountId]?.mint ?? [])
    : []
  const counters = activeAccountId ? (allCounters[activeAccountId] ?? []) : []

  return {
    accounts,
    activeAccount,
    activeAccountId,
    allMints,
    counters,
    mintQuotes,
    mints,
    proofs,
    transactions
  }
}
