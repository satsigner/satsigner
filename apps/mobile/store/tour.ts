import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

export type TourStep =
  | 'idle'
  | 'go_to_bitcoin'
  | 'add_account'
  | 'account_setup'
  | 'explore_wallet'
  | 'receive'
  | 'no_utxos'
  | 'select_utxos'
  | 'preview_tx'
  | 'sign_tx'
  | 'broadcast_confirm'

type TourStatus = 'idle' | 'active' | 'completed' | 'paused'

type TourState = {
  status: TourStatus
  neverAskAgain: boolean
  settingsBannerDismissed: boolean
  currentStep: TourStep
  accountId: string | null
  prefillAccountName: string | null
}

type TourAction = {
  startTour: () => void
  exitTour: () => void
  completeTour: () => void
  setNeverAskAgain: () => void
  setTourPrompts: (enabled: boolean) => void
  dismissSettingsBanner: () => void
  advanceStep: (step: TourStep) => void
  setAccountId: (id: string) => void
  setPrefillAccountName: (name: string | null) => void
  resetTour: () => void
}

const useTourStore = create<TourState & TourAction>()(
  persist(
    (set) => ({
      accountId: null,
      advanceStep: (step) => set({ currentStep: step }),
      completeTour: () =>
        set({
          currentStep: 'idle',
          prefillAccountName: null,
          status: 'completed'
        }),
      currentStep: 'idle',
      dismissSettingsBanner: () => set({ settingsBannerDismissed: true }),
      exitTour: () =>
        set({
          currentStep: 'idle',
          prefillAccountName: null,
          status: 'paused'
        }),
      neverAskAgain: false,
      prefillAccountName: null,
      resetTour: () =>
        set({
          accountId: null,
          currentStep: 'idle',
          prefillAccountName: null,
          status: 'idle'
        }),
      setAccountId: (id) => set({ accountId: id }),
      setNeverAskAgain: () =>
        set({ neverAskAgain: true, settingsBannerDismissed: true }),
      setPrefillAccountName: (name) => set({ prefillAccountName: name }),
      setTourPrompts: (enabled) =>
        set({
          neverAskAgain: !enabled,
          settingsBannerDismissed: !enabled
        }),
      settingsBannerDismissed: false,
      startTour: () => set({ currentStep: 'go_to_bitcoin', status: 'active' }),
      status: 'idle'
    }),
    {
      name: 'tour-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useTourStore }
