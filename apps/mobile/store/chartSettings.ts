import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type ChartSettingState = {
  showLabel: boolean
  showAmount: boolean
  showTransactionInfo: boolean
  showOutputField: boolean
  lockZoomToXAxis: boolean
}

type ChartSettingAction = {
  setShowLabel: (showLabel: boolean) => void
  setShowAmount: (showAmount: boolean) => void
  setShowTransactionInfo: (showTransactionInfo: boolean) => void
  setShowOutputField: (showOutputField: boolean) => void
  setLockZoomToXAxis: (lockZoomToXAxis: boolean) => void
}

const useChartSettingStore = create<ChartSettingState & ChartSettingAction>()(
  persist(
    (set) => ({
      showLabel: true,
      showAmount: true,
      showTransactionInfo: true,
      showOutputField: false,
      lockZoomToXAxis: true,
      setShowLabel: (showLabel) => {
        set({ showLabel })
      },
      setShowAmount: (showAmount) => {
        set({ showAmount })
      },
      setShowTransactionInfo: (showTransactionInfo) => {
        set({ showTransactionInfo })
      },
      setShowOutputField: (showOutputField) => {
        set({ showOutputField })
      },
      setLockZoomToXAxis: (lockZoomToXAxis) => {
        set({ lockZoomToXAxis })
      }
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useChartSettingStore }
