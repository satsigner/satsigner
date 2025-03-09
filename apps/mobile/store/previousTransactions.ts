import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type EsploraTx } from '@/api/esplora'
import mmkvStorage from '@/storage/mmkv'

interface PreviousTransactionsState {
  transactions: Record<string, EsploraTx>
  addTransactions: (newTransactions: Map<string, EsploraTx>) => void
  getTransaction: (txid: string) => EsploraTx | undefined
  clear: () => void
}

export const usePreviousTransactionsStore = create<PreviousTransactionsState>()(
  persist(
    (set, get) => ({
      transactions: {},
      addTransactions: (newTransactions: Map<string, EsploraTx>) => {
        set((state) => ({
          transactions: {
            ...state.transactions,
            ...Object.fromEntries(newTransactions)
          }
        }))
      },
      getTransaction: (txid: string) => {
        return get().transactions[txid]
      },
      clear: () => {
        set({ transactions: {} })
      }
    }),
    {
      name: 'previous-transactions',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)
