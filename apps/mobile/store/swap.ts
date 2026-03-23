import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { BOLTZ_CLEARNET_URL } from '@/api/boltz'
import mmkvStorage from '@/storage/mmkv'
import { type Swap, type SwapStatus } from '@/types/models/Swap'

type SwapState = {
  swaps: Swap[]
  boltzUrl: string
  addSwap: (swap: Swap) => void
  updateSwapStatus: (
    id: string,
    status: SwapStatus,
    extra?: Partial<Swap>
  ) => void
  getSwapsByAccount: (accountId: string) => Swap[]
  setBoltzUrl: (url: string) => void
}

export const useSwapStore = create<SwapState>()(
  persist(
    (set, get) => ({
      swaps: [],
      boltzUrl: BOLTZ_CLEARNET_URL,
      addSwap: (swap) => set((state) => ({ swaps: [swap, ...state.swaps] })),
      updateSwapStatus: (id, status, extra = {}) =>
        set((state) => ({
          swaps: state.swaps.map((s) =>
            s.id === id ? { ...s, status, ...extra } : s
          )
        })),
      getSwapsByAccount: (accountId) =>
        get().swaps.filter(
          (s) =>
            s.sourceAccountId === accountId ||
            s.destinationAccountId === accountId
        ),
      setBoltzUrl: (url) => set({ boltzUrl: url })
    }),
    {
      name: 'satsigner-swaps',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)
