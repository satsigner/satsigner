import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'
import type {
  ArkAccount,
  ArkAccountStats,
  ArkBalance,
  ArkBoardIntent,
  ArkPendingBoard
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
  // Funding txs cosigned by the Ark server. Replacing one (RBF) would orphan
  // the board, so fee-bump and cancel stay disabled for these txids.
  boardFundingTxids: string[]
  // Board funding addresses handed to the transaction builder, keyed by
  // address. Any transaction paying one must be cosigned before broadcast,
  // whatever happened to the draft in between.
  boardIntents: Record<string, ArkBoardIntent>
  autoBoardDisabledIds: string[]
}

type ArkAction = {
  addAccount: (account: ArkAccount) => void
  addBoardFundingTxid: (txid: string) => void
  addBoardIntent: (intent: ArkBoardIntent) => void
  markBoardIntentCosigned: (address: string, board: ArkPendingBoard) => void
  removeAccount: (accountId: string) => void
  setAutoBoardEnabled: (accountId: string, enabled: boolean) => void
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
      addBoardFundingTxid: (txid) =>
        set((state) =>
          state.boardFundingTxids.includes(txid)
            ? state
            : { boardFundingTxids: [...state.boardFundingTxids, txid] }
        ),
      addBoardIntent: (intent) =>
        set((state) => ({
          boardIntents: { ...state.boardIntents, [intent.address]: intent }
        })),
      autoBoardDisabledIds: [],
      balances: {},
      boardFundingTxids: [],
      boardIntents: {},
      clearAllData: () =>
        set({
          accounts: [],
          autoBoardDisabledIds: [],
          balances: {},
          boardFundingTxids: [],
          boardIntents: {},
          stats: {}
        }),
      markBoardIntentCosigned: (address, board) =>
        set((state) => {
          const intent = state.boardIntents[address]
          if (!intent) {
            return state
          }
          return {
            boardIntents: {
              ...state.boardIntents,
              [address]: { ...intent, cosigned: board }
            }
          }
        }),
      removeAccount: (accountId) =>
        set((state) => {
          const { [accountId]: _b, ...remainingBalances } = state.balances
          const { [accountId]: _s, ...remainingStats } = state.stats
          // boardFundingTxids stay: replacing a funding tx would still orphan
          // the board, and its funds outlive the account.
          return {
            accounts: state.accounts.filter((a) => a.id !== accountId),
            autoBoardDisabledIds: state.autoBoardDisabledIds.filter(
              (id) => id !== accountId
            ),
            balances: remainingBalances,
            boardIntents: Object.fromEntries(
              Object.entries(state.boardIntents).filter(
                ([, intent]) => intent.arkAccountId !== accountId
              )
            ),
            stats: remainingStats
          }
        }),
      setAutoBoardEnabled: (accountId, enabled) =>
        set((state) => {
          const others = state.autoBoardDisabledIds.filter(
            (id) => id !== accountId
          )
          return {
            autoBoardDisabledIds: enabled ? others : [...others, accountId]
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
        autoBoardDisabledIds: state.autoBoardDisabledIds,
        balances: state.balances,
        boardFundingTxids: state.boardFundingTxids,
        boardIntents: state.boardIntents,
        stats: state.stats
      }),
      storage: createJSONStorage(() => mmkvStorage),
      version: 1
    }
  )
)

export function getArkAccountOrThrow(accountId: string): ArkAccount {
  const account = useArkStore
    .getState()
    .accounts.find((a) => a.id === accountId)
  if (!account) {
    throw new Error('Ark account not found')
  }
  return account
}
