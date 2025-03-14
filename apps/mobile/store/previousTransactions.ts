import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type EsploraTx } from '@/api/esplora'
import mmkvStorage from '@/storage/mmkv'

type PreviousTransactionsState = {
  transactions: Record<string, EsploraTx>
}

type PreviousTransactionsAction = {
  addTransactions: (newTransactions: Map<string, EsploraTx>) => void
  clearTransactions: () => void
}

const usePreviousTransactionsStore = create<
  PreviousTransactionsState & PreviousTransactionsAction
>()(
  persist(
    (set) => ({
      transactions: {},
      addTransactions: (newTransactions: Map<string, EsploraTx>) => {
        set((state) => ({
          transactions: {
            ...state.transactions,
            ...Object.fromEntries(newTransactions)
          }
        }))
      },
      clearTransactions: () => {
        set({ transactions: {} })
      }
    }),
    {
      name: 'satsigner-previous-transactions',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { usePreviousTransactionsStore }
