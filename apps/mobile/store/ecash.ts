import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import {
  type EcashConnectionStatus,
  type EcashMint,
  type EcashProof,
  type EcashTransaction,
  type MeltQuote,
  type MintQuote
} from '@/types/models/Ecash'

type EcashState = {
  mints: EcashMint[]
  activeMint: EcashMint | null
  proofs: EcashProof[]
  transactions: EcashTransaction[]
  quotes: {
    mint: MintQuote[]
    melt: MeltQuote[]
  }
  status: EcashConnectionStatus
  checkingTransactionIds: string[]
}

type EcashAction = {
  setMints: (mints: EcashState['mints']) => void
  addMint: (mint: EcashMint) => void
  removeMint: (mintUrl: string) => void
  setActiveMint: (mint: EcashState['activeMint']) => void
  setProofs: (proofs: EcashState['proofs']) => void
  addProofs: (proofs: EcashProof[]) => void
  removeProofs: (proofIds: string[]) => void
  setConnecting: (isConnecting: EcashState['status']['isConnecting']) => void
  setConnected: (isConnected: EcashState['status']['isConnected']) => void
  setError: (error: EcashState['status']['lastError']) => void
  updateLastSync: () => void
  addMintQuote: (quote: MintQuote) => void
  removeMintQuote: (quoteId: string) => void
  addMeltQuote: (quote: MeltQuote) => void
  removeMeltQuote: (quoteId: string) => void
  updateMintBalance: (mintUrl: string, balance: number) => void
  updateMintConnection: (mintUrl: string, isConnected: boolean) => void
  addTransaction: (transaction: EcashTransaction) => void
  updateTransaction: (
    transactionId: string,
    updates: Partial<EcashTransaction>
  ) => void
  clearTransactions: () => void
  restoreFromBackup: (backupData: unknown) => void
  clearAllData: () => void
  addCheckingTransaction: (transactionId: string) => void
  removeCheckingTransaction: (transactionId: string) => void
  clearCheckingTransactions: () => void
}

const initialStatus: EcashConnectionStatus = {
  isConnected: false,
  isConnecting: false
}

export const useEcashStore = create<EcashState & EcashAction>()(
  persist(
    (set) => ({
      mints: [],
      activeMint: null,
      proofs: [],
      transactions: [],
      quotes: {
        mint: [],
        melt: []
      },
      status: initialStatus,
      checkingTransactionIds: [],
      setMints: (mints) => set({ mints }),
      addMint: (mint) =>
        set((state) => ({
          mints: [...state.mints, mint]
        })),
      removeMint: (mintUrl) =>
        set((state) => ({
          mints: state.mints.filter((mint) => mint.url !== mintUrl),
          activeMint:
            state.activeMint?.url === mintUrl ? null : state.activeMint
        })),
      setActiveMint: (mint) =>
        set((state) => {
          // If mint is provided, find it in mints array to ensure sync
          if (mint) {
            const mintFromArray = state.mints.find((m) => m.url === mint.url)
            return { activeMint: mintFromArray || mint }
          }
          return { activeMint: null }
        }),
      setProofs: (proofs) => set({ proofs }),
      addProofs: (proofs) =>
        set((state) => ({
          proofs: [...state.proofs, ...proofs]
        })),
      removeProofs: (proofIds) =>
        set((state) => ({
          proofs: state.proofs.filter((proof) => !proofIds.includes(proof.id))
        })),
      setConnecting: (isConnecting) =>
        set((state) => ({
          status: { ...state.status, isConnecting }
        })),
      setConnected: (isConnected) =>
        set((state) => ({
          status: { ...state.status, isConnected, isConnecting: false }
        })),
      setError: (error) =>
        set((state) => ({
          status: { ...state.status, lastError: error }
        })),
      updateLastSync: () =>
        set((state) => ({
          status: { ...state.status, lastSync: new Date().toISOString() }
        })),
      addMintQuote: (quote) =>
        set((state) => ({
          quotes: {
            ...state.quotes,
            mint: [...state.quotes.mint, quote]
          }
        })),
      removeMintQuote: (quoteId) =>
        set((state) => ({
          quotes: {
            ...state.quotes,
            mint: state.quotes.mint.filter((quote) => quote.quote !== quoteId)
          }
        })),
      addMeltQuote: (quote) =>
        set((state) => ({
          quotes: {
            ...state.quotes,
            melt: [...state.quotes.melt, quote]
          }
        })),
      removeMeltQuote: (quoteId) =>
        set((state) => ({
          quotes: {
            ...state.quotes,
            melt: state.quotes.melt.filter((quote) => quote.quote !== quoteId)
          }
        })),
      updateMintBalance: (mintUrl, balance) =>
        set((state) => ({
          mints: state.mints.map((mint) =>
            mint.url === mintUrl ? { ...mint, balance } : mint
          ),
          activeMint:
            state.activeMint?.url === mintUrl
              ? { ...state.activeMint, balance }
              : state.activeMint
        })),
      updateMintConnection: (mintUrl, isConnected) =>
        set((state) => ({
          mints: state.mints.map((mint) =>
            mint.url === mintUrl ? { ...mint, isConnected } : mint
          ),
          activeMint:
            state.activeMint?.url === mintUrl
              ? { ...state.activeMint, isConnected }
              : state.activeMint
        })),
      addTransaction: (transaction) =>
        set((state) => ({
          transactions: [transaction, ...state.transactions]
        })),
      updateTransaction: (transactionId, updates) =>
        set((state) => ({
          transactions: state.transactions.map((transaction) =>
            transaction.id === transactionId
              ? { ...transaction, ...updates }
              : transaction
          )
        })),
      clearTransactions: () => set({ transactions: [] }),
      restoreFromBackup: (backupData) =>
        set(() => {
          // Validate backup data structure
          if (!backupData || typeof backupData !== 'object') {
            throw new Error('Invalid backup data format')
          }

          const data = backupData as {
            mints?: EcashMint[]
            proofs?: EcashProof[]
            transactions?: EcashTransaction[]
            activeMint?: EcashMint | null
          }

          const restoredMints = data.mints || []
          const restoredProofs = data.proofs || []
          const restoredTransactions = data.transactions || []
          const restoredActiveMint = data.activeMint || null

          return {
            mints: restoredMints,
            activeMint: restoredActiveMint,
            proofs: restoredProofs,
            transactions: restoredTransactions,
            quotes: {
              mint: [],
              melt: []
            },
            status: {
              isConnected: false,
              isConnecting: false,
              lastSync: new Date().toISOString()
            }
          }
        }),
      clearAllData: () =>
        set({
          mints: [],
          activeMint: null,
          proofs: [],
          transactions: [],
          quotes: {
            mint: [],
            melt: []
          },
          status: initialStatus,
          checkingTransactionIds: []
        }),
      addCheckingTransaction: (transactionId) =>
        set((state) => ({
          checkingTransactionIds: state.checkingTransactionIds.includes(
            transactionId
          )
            ? state.checkingTransactionIds
            : [...state.checkingTransactionIds, transactionId]
        })),
      removeCheckingTransaction: (transactionId) =>
        set((state) => ({
          checkingTransactionIds: state.checkingTransactionIds.filter(
            (id) => id !== transactionId
          )
        })),
      clearCheckingTransactions: () => set({ checkingTransactionIds: [] })
    }),
    {
      name: 'satsigner-ecash',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        mints: state.mints,
        activeMint: state.activeMint,
        proofs: state.proofs,
        transactions: state.transactions,
        quotes: state.quotes,
        status: {
          isConnected: state.status.isConnected,
          lastSync: state.status.lastSync
        },
        checkingTransactionIds: [] // Don't persist checking state
      })
    }
  )
)
