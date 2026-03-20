import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type ChartSettingState = {
  showLabel: boolean
  showAmount: boolean
  showTransactionInfo: boolean
  showOutputField: boolean
  lockZoomToXAxis: boolean
  showFiatOnChart: boolean
  showFiatAtTxTime: boolean
  showFiatPercentageChange: boolean
}

type ChartSettingAction = {
  setShowLabel: (showLabel: ChartSettingState['showLabel']) => void
  setShowAmount: (showAmount: ChartSettingState['showAmount']) => void
  setShowTransactionInfo: (
    showTransactionInfo: ChartSettingState['showTransactionInfo']
  ) => void
  setShowOutputField: (
    showOutputField: ChartSettingState['showOutputField']
  ) => void
  setLockZoomToXAxis: (
    lockZoomToXAxis: ChartSettingState['lockZoomToXAxis']
  ) => void
  setShowFiatOnChart: (
    showFiatOnChart: ChartSettingState['showFiatOnChart']
  ) => void
  setShowFiatAtTxTime: (
    showFiatAtTxTime: ChartSettingState['showFiatAtTxTime']
  ) => void
  setShowFiatPercentageChange: (
    showFiatPercentageChange: ChartSettingState['showFiatPercentageChange']
  ) => void
}

const useChartSettingStore = create<ChartSettingState & ChartSettingAction>()(
  persist(
    (set) => ({
      showLabel: true,
      showAmount: true,
      showTransactionInfo: true,
      showOutputField: false,
      lockZoomToXAxis: true,
      showFiatOnChart: false,
      showFiatAtTxTime: false,
      showFiatPercentageChange: false,
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
      },
      setShowFiatOnChart: (showFiatOnChart) => {
        set({ showFiatOnChart })
        if (!showFiatOnChart) {
          set({ showFiatAtTxTime: false })
        }
      },
      setShowFiatAtTxTime: (showFiatAtTxTime) => {
        set({ showFiatAtTxTime })
      },
      setShowFiatPercentageChange: (showFiatPercentageChange) => {
        set({ showFiatPercentageChange })
      }
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useChartSettingStore }
