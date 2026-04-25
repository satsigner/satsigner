import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type { ArkAccount, ArkBalance } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

type BalanceMap = Record<string, ArkBalance | undefined>

type ArkState = {
  accounts: ArkAccount[]
  balances: BalanceMap
  serverAccessTokens: Partial<Record<Network, string>>
}

type ArkAction = {
  addAccount: (account: ArkAccount) => void
  removeAccount: (accountId: string) => void
  updateBalance: (accountId: string, balance: ArkBalance) => void
  setServerAccessToken: (network: Network, token: string) => void
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
          serverAccessTokens: {}
        }),
      removeAccount: (accountId) =>
        set((state) => {
          const { [accountId]: _b, ...remainingBalances } = state.balances
          return {
            accounts: state.accounts.filter((a) => a.id !== accountId),
            balances: remainingBalances
          }
        }),
      serverAccessTokens: {},
      setServerAccessToken: (network, token) =>
        set((state) => ({
          serverAccessTokens: {
            ...state.serverAccessTokens,
            [network]: token
          }
        })),
      updateBalance: (accountId, balance) =>
        set((state) => ({
          balances: { ...state.balances, [accountId]: balance }
        }))
    }),
    {
      name: 'satsigner-ark',
      partialize: (state) => ({
        accounts: state.accounts,
        balances: state.balances,
        serverAccessTokens: state.serverAccessTokens
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)
