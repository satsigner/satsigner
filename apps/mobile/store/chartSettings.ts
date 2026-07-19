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
  showTransactionFlowChart: boolean
  showUtxoFlowChart: boolean
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
  setShowTransactionFlowChart: (
    showTransactionFlowChart: ChartSettingState['showTransactionFlowChart']
  ) => void
  setShowUtxoFlowChart: (
    showUtxoFlowChart: ChartSettingState['showUtxoFlowChart']
  ) => void
}

const useChartSettingStore = create<ChartSettingState & ChartSettingAction>()(
  persist(
    (set) => ({
      lockZoomToXAxis: true,
      setLockZoomToXAxis: (lockZoomToXAxis) => {
        set({ lockZoomToXAxis })
      },
      setShowAmount: (showAmount) => {
        set({ showAmount })
      },
      setShowFiatAtTxTime: (showFiatAtTxTime) => {
        set({ showFiatAtTxTime })
      },
      setShowFiatOnChart: (showFiatOnChart) => {
        set({ showFiatOnChart })
        if (!showFiatOnChart) {
          set({ showFiatAtTxTime: false })
        }
      },
      setShowFiatPercentageChange: (showFiatPercentageChange) => {
        set({ showFiatPercentageChange })
      },
      setShowLabel: (showLabel) => {
        set({ showLabel })
      },
      setShowOutputField: (showOutputField) => {
        set({ showOutputField })
      },
      setShowTransactionFlowChart: (showTransactionFlowChart) => {
        set({ showTransactionFlowChart })
      },
      setShowTransactionInfo: (showTransactionInfo) => {
        set({ showTransactionInfo })
      },
      setShowUtxoFlowChart: (showUtxoFlowChart) => {
        set({ showUtxoFlowChart })
      },
      showAmount: true,
      showFiatAtTxTime: false,
      showFiatOnChart: false,
      showFiatPercentageChange: false,
      showLabel: true,
      showOutputField: false,
      showTransactionFlowChart: true,
      showTransactionInfo: true,
      showUtxoFlowChart: true
    }),
    {
      name: 'satsigner-blockchain',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { useChartSettingStore }
