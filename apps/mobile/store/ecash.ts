import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  EcashAccount,
  EcashKeysetCounter,
  EcashMint,
  EcashProof,
  EcashTransaction,
  MeltQuote,
  MintQuote
} from '@/types/models/Ecash'

const LEGACY_ACCOUNT_ID = 'legacy'

type AccountMap<T> = Record<string, T>

type EcashState = {
  accounts: EcashAccount[]
  activeAccountId: string | null
  mints: AccountMap<EcashMint[]>
  proofs: AccountMap<EcashProof[]>
  transactions: AccountMap<EcashTransaction[]>
  quotes: AccountMap<{ mint: MintQuote[]; melt: MeltQuote[] }>
  counters: AccountMap<EcashKeysetCounter[]>
  checkingTransactionIds: string[]
}

type EcashAction = {
  addAccount: (account: EcashAccount) => void
  removeAccount: (accountId: string) => void
  setActiveAccountId: (accountId: string | null) => void
  addMint: (accountId: string, mint: EcashMint) => void
  removeMint: (accountId: string, mintUrl: string) => void
  addProofs: (accountId: string, proofs: EcashProof[]) => void
  removeProofs: (accountId: string, proofIds: string[]) => void
  setProofs: (accountId: string, proofs: EcashProof[]) => void
  updateMintBalance: (
    accountId: string,
    mintUrl: string,
    balance: number
  ) => void
  updateMintConnection: (
    accountId: string,
    mintUrl: string,
    isConnected: boolean
  ) => void
  addMintQuote: (accountId: string, quote: MintQuote) => void
  removeMintQuote: (accountId: string, quoteId: string) => void
  addMeltQuote: (accountId: string, quote: MeltQuote) => void
  removeMeltQuote: (accountId: string, quoteId: string) => void
  addTransaction: (accountId: string, transaction: EcashTransaction) => void
  updateTransaction: (
    accountId: string,
    transactionId: string,
    updates: Partial<EcashTransaction>
  ) => void
  clearTransactions: (accountId: string) => void
  updateCounters: (accountId: string, counters: EcashKeysetCounter[]) => void
  restoreFromBackup: (accountId: string, backupData: unknown) => void
  clearAllData: () => void
  clearAccountData: (accountId: string) => void
  addCheckingTransaction: (transactionId: string) => void
  removeCheckingTransaction: (transactionId: string) => void
  clearCheckingTransactions: () => void
}

function getAccountArray<T>(map: AccountMap<T[]>, accountId: string): T[] {
  return map[accountId] ?? []
}

function getAccountQuotes(
  map: AccountMap<{ mint: MintQuote[]; melt: MeltQuote[] }>,
  accountId: string
) {
  return map[accountId] ?? { melt: [], mint: [] }
}

type LegacyState = {
  mints?: EcashMint[]
  activeMint?: EcashMint | null
  proofs?: EcashProof[]
  transactions?: EcashTransaction[]
  quotes?: { mint: MintQuote[]; melt: MeltQuote[] }
}

function migrateLegacyState(persisted: unknown): EcashState & EcashAction {
  const legacy = persisted as LegacyState & EcashState & EcashAction

  if (legacy.accounts) {
    return legacy
  }

  const hasLegacyData =
    (Array.isArray(legacy.mints) && legacy.mints.length > 0) ||
    (Array.isArray(legacy.proofs) && legacy.proofs.length > 0) ||
    (Array.isArray(legacy.transactions) && legacy.transactions.length > 0)

  if (!hasLegacyData) {
    return legacy
  }

  const legacyAccount: EcashAccount = {
    createdAt: new Date().toISOString(),
    hasSeed: false,
    id: LEGACY_ACCOUNT_ID,
    name: 'Legacy Ecash'
  }

  const legacyMints = legacy.mints ?? []
  const legacyProofs = (legacy.proofs ?? []).map((proof) => ({
    ...proof,
    mintUrl: proof.mintUrl ?? legacy.activeMint?.url ?? ''
  }))
  const legacyTransactions = legacy.transactions ?? []
  const legacyQuotes = legacy.quotes ?? { melt: [], mint: [] }

  return {
    ...legacy,
    accounts: [legacyAccount],
    activeAccountId: LEGACY_ACCOUNT_ID,
    counters: {},
    mints: { [LEGACY_ACCOUNT_ID]: legacyMints },
    proofs: { [LEGACY_ACCOUNT_ID]: legacyProofs },
    quotes: { [LEGACY_ACCOUNT_ID]: legacyQuotes },
    transactions: { [LEGACY_ACCOUNT_ID]: legacyTransactions }
  }
}

export const useEcashStore = create<EcashState & EcashAction>()(
  persist(
    (set) => ({
      accounts: [],
      activeAccountId: null,
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
          counters: { ...state.counters, [account.id]: [] },
          mints: { ...state.mints, [account.id]: [] },
          proofs: { ...state.proofs, [account.id]: [] },
          quotes: {
            ...state.quotes,
            [account.id]: { melt: [], mint: [] }
          },
          transactions: { ...state.transactions, [account.id]: [] }
        })),
      addCheckingTransaction: (transactionId) =>
        set((state) => ({
          checkingTransactionIds: state.checkingTransactionIds.includes(
            transactionId
          )
            ? state.checkingTransactionIds
            : [...state.checkingTransactionIds, transactionId]
        })),
      addMeltQuote: (accountId, quote) =>
        set((state) => {
          const current = getAccountQuotes(state.quotes, accountId)
          return {
            quotes: {
              ...state.quotes,
              [accountId]: {
                ...current,
                melt: [...current.melt, quote]
              }
            }
          }
        }),
      addMint: (accountId, mint) =>
        set((state) => ({
          mints: {
            ...state.mints,
            [accountId]: [...getAccountArray(state.mints, accountId), mint]
          }
        })),
      addMintQuote: (accountId, quote) =>
        set((state) => {
          const current = getAccountQuotes(state.quotes, accountId)
          return {
            quotes: {
              ...state.quotes,
              [accountId]: {
                ...current,
                mint: [...current.mint, quote]
              }
            }
          }
        }),
      addProofs: (accountId, proofs) =>
        set((state) => ({
          proofs: {
            ...state.proofs,
            [accountId]: [
              ...getAccountArray(state.proofs, accountId),
              ...proofs
            ]
          }
        })),
      addTransaction: (accountId, transaction) =>
        set((state) => ({
          transactions: {
            ...state.transactions,
            [accountId]: [
              transaction,
              ...getAccountArray(state.transactions, accountId)
            ]
          }
        })),
      checkingTransactionIds: [],
      clearAccountData: (accountId) =>
        set((state) => ({
          counters: { ...state.counters, [accountId]: [] },
          mints: { ...state.mints, [accountId]: [] },
          proofs: { ...state.proofs, [accountId]: [] },
          quotes: {
            ...state.quotes,
            [accountId]: { melt: [], mint: [] }
          },
          transactions: { ...state.transactions, [accountId]: [] }
        })),
      clearAllData: () =>
        set({
          accounts: [],
          activeAccountId: null,
          checkingTransactionIds: [],
          counters: {},
          mints: {},
          proofs: {},
          quotes: {},
          transactions: {}
        }),
      clearCheckingTransactions: () => set({ checkingTransactionIds: [] }),
      clearTransactions: (accountId) =>
        set((state) => ({
          transactions: { ...state.transactions, [accountId]: [] }
        })),
      counters: {},
      mints: {},
      proofs: {},
      quotes: {},
      removeAccount: (accountId) =>
        set((state) => {
          const { [accountId]: _m, ...remainingMints } = state.mints
          const { [accountId]: _p, ...remainingProofs } = state.proofs
          const { [accountId]: _t, ...remainingTxns } = state.transactions
          const { [accountId]: _q, ...remainingQuotes } = state.quotes
          const { [accountId]: _c, ...remainingCounters } = state.counters
          return {
            accounts: state.accounts.filter((a) => a.id !== accountId),
            activeAccountId:
              state.activeAccountId === accountId
                ? null
                : state.activeAccountId,
            counters: remainingCounters,
            mints: remainingMints,
            proofs: remainingProofs,
            quotes: remainingQuotes,
            transactions: remainingTxns
          }
        }),
      removeCheckingTransaction: (transactionId) =>
        set((state) => ({
          checkingTransactionIds: state.checkingTransactionIds.filter(
            (id) => id !== transactionId
          )
        })),
      removeMeltQuote: (accountId, quoteId) =>
        set((state) => {
          const current = getAccountQuotes(state.quotes, accountId)
          return {
            quotes: {
              ...state.quotes,
              [accountId]: {
                ...current,
                melt: current.melt.filter((q) => q.quote !== quoteId)
              }
            }
          }
        }),
      removeMint: (accountId, mintUrl) =>
        set((state) => ({
          mints: {
            ...state.mints,
            [accountId]: getAccountArray(state.mints, accountId).filter(
              (m) => m.url !== mintUrl
            )
          }
        })),
      removeMintQuote: (accountId, quoteId) =>
        set((state) => {
          const current = getAccountQuotes(state.quotes, accountId)
          return {
            quotes: {
              ...state.quotes,
              [accountId]: {
                ...current,
                mint: current.mint.filter((q) => q.quote !== quoteId)
              }
            }
          }
        }),
      removeProofs: (accountId, proofIds) =>
        set((state) => ({
          proofs: {
            ...state.proofs,
            [accountId]: getAccountArray(state.proofs, accountId).filter(
              (p) => !proofIds.includes(p.id)
            )
          }
        })),
      restoreFromBackup: (accountId, backupData) =>
        set((state) => {
          if (!backupData || typeof backupData !== 'object') {
            throw new Error('Invalid backup data format')
          }

          const data = backupData as {
            mints?: EcashMint[]
            proofs?: EcashProof[]
            transactions?: EcashTransaction[]
          }

          return {
            mints: {
              ...state.mints,
              [accountId]: data.mints ?? []
            },
            proofs: {
              ...state.proofs,
              [accountId]: data.proofs ?? []
            },
            quotes: {
              ...state.quotes,
              [accountId]: { melt: [], mint: [] }
            },
            transactions: {
              ...state.transactions,
              [accountId]: data.transactions ?? []
            }
          }
        }),
      setActiveAccountId: (accountId) => set({ activeAccountId: accountId }),
      setProofs: (accountId, proofs) =>
        set((state) => ({
          proofs: { ...state.proofs, [accountId]: proofs }
        })),
      transactions: {},
      updateCounters: (accountId, counters) =>
        set((state) => ({
          counters: { ...state.counters, [accountId]: counters }
        })),
      updateMintBalance: (accountId, mintUrl, balance) =>
        set((state) => ({
          mints: {
            ...state.mints,
            [accountId]: getAccountArray(state.mints, accountId).map((m) =>
              m.url === mintUrl ? { ...m, balance } : m
            )
          }
        })),
      updateMintConnection: (accountId, mintUrl, isConnected) =>
        set((state) => ({
          mints: {
            ...state.mints,
            [accountId]: getAccountArray(state.mints, accountId).map((m) =>
              m.url === mintUrl ? { ...m, isConnected } : m
            )
          }
        })),
      updateTransaction: (accountId, transactionId, updates) =>
        set((state) => ({
          transactions: {
            ...state.transactions,
            [accountId]: getAccountArray(state.transactions, accountId).map(
              (tx) => (tx.id === transactionId ? { ...tx, ...updates } : tx)
            )
          }
        }))
    }),
    {
      merge: (persisted, current) => {
        const migrated = migrateLegacyState(persisted)
        return { ...current, ...migrated }
      },
      name: 'satsigner-ecash',
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        checkingTransactionIds: [],
        counters: state.counters,
        mints: state.mints,
        proofs: state.proofs,
        quotes: state.quotes,
        transactions: state.transactions
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 2
    }
  )
)
