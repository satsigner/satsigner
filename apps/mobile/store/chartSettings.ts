import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import mmkvStorage from '@/storage/mmkv'

type ChartSettingState = {
  lockZoomToXAxis: boolean
  showAmount: boolean
  showFiatAtTxTime: boolean
  showFiatOnChart: boolean
  showFiatPercentageChange: boolean
  showLabel: boolean
  showOutputField: boolean
  showTransactionFlowChart: boolean
  showTransactionInfo: boolean
  showUtxoFlowChart: boolean
}

type ChartSettingAction = {
  setLockZoomToXAxis: (
    lockZoomToXAxis: ChartSettingState['lockZoomToXAxis']
  ) => void
  setShowAmount: (showAmount: ChartSettingState['showAmount']) => void
  setShowFiatAtTxTime: (
    showFiatAtTxTime: ChartSettingState['showFiatAtTxTime']
  ) => void
  setShowFiatOnChart: (
    showFiatOnChart: ChartSettingState['showFiatOnChart']
  ) => void
  setShowFiatPercentageChange: (
    showFiatPercentageChange: ChartSettingState['showFiatPercentageChange']
  ) => void
  setShowLabel: (showLabel: ChartSettingState['showLabel']) => void
  setShowOutputField: (
    showOutputField: ChartSettingState['showOutputField']
  ) => void
  setShowTransactionFlowChart: (
    showTransactionFlowChart: ChartSettingState['showTransactionFlowChart']
  ) => void
  setShowTransactionInfo: (
    showTransactionInfo: ChartSettingState['showTransactionInfo']
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
