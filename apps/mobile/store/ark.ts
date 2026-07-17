import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  ArkAccount,
  ArkAccountStats,
  ArkBalance
} from '@/types/models/Ark'

type BalanceMap = Record<string, ArkBalance | undefined>

type StatsMap = Record<string, ArkAccountStats | undefined>

const DEFAULT_ACCOUNT_STATS: ArkAccountStats = {
  numberOfAddresses: 0,
  numberOfRefreshes: 0,
  numberOfTransactions: 0,
  numberOfVtxos: 0
}

type ArkState = {
  accounts: ArkAccount[]
  balances: BalanceMap
  stats: StatsMap
}

type ArkAction = {
  addAccount: (account: ArkAccount) => void
  removeAccount: (accountId: string) => void
  updateBalance: (accountId: string, balance: ArkBalance) => void
  updateStats: (accountId: string, stats: Partial<ArkAccountStats>) => void
  clearAllData: () => void
}

export const useArkStore = create<ArkState & ArkAction>()(
  persist(
    (set) => ({
      accounts: [],
      addAccount: (account) =>
        set((state) => ({
          accounts: [...state.accounts, account],
          balances: { ...state.balances, [account.id]: undefined }
        })),
      balances: {},
      clearAllData: () =>
        set({
          accounts: [],
          balances: {},
          stats: {}
        }),
      removeAccount: (accountId) =>
        set((state) => {
          const { [accountId]: _b, ...remainingBalances } = state.balances
          const { [accountId]: _s, ...remainingStats } = state.stats
          return {
            accounts: state.accounts.filter((a) => a.id !== accountId),
            balances: remainingBalances,
            stats: remainingStats
          }
        }),
      stats: {},
      updateBalance: (accountId, balance) =>
        set((state) => ({
          balances: { ...state.balances, [accountId]: balance }
        })),
      updateStats: (accountId, stats) =>
        set((state) => ({
          stats: {
            ...state.stats,
            [accountId]: {
              ...DEFAULT_ACCOUNT_STATS,
              ...state.stats[accountId],
              ...stats
            }
          }
        }))
    }),
    {
      name: 'satsigner-ark',
      partialize: (state) => ({
        accounts: state.accounts,
        balances: state.balances,
        stats: state.stats
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)
