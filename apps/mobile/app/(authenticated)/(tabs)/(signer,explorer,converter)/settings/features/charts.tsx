import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { FIAT_DATA_SETTINGS_ROUTE } from '@/constants/routes'
import { useFiatData } from '@/hooks/useFiatData'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useChartSettingStore } from '@/store/chartSettings'
import { missingHistoricalFiatData } from '@/utils/fiat'

const FIAT_DATA_LINK_LABELS = {
  currentPrices:
    'settings.features.charts.historyChart.layers.turnOnCurrentPrices',
  historicalPrices:
    'settings.features.charts.historyChart.layers.turnOnHistoricalPrices'
}

export default function Charts() {
  const router = useRouter()
  const { showCurrentFiat, showHistoricalFiat } = useFiatData()
  const [
    showLabel,
    setShowLabel,
    showAmount,
    setShowAmount,
    showTransactionInfo,
    setShowTransactionInfo,
    showOutputField,
    setShowOutputField,
    lockZoomToXAxis,
    setLockZoomToXAxis,
    showFiatOnChart,
    setShowFiatOnChart,
    showFiatAtTxTime,
    setShowFiatAtTxTime,
    showFiatPercentageChange,
    setShowFiatPercentageChange,
    showHistoricalFiatLine,
    setShowHistoricalFiatLine,
    showTransactionFlowChart,
    setShowTransactionFlowChart,
    showUtxoFlowChart,
    setShowUtxoFlowChart
  ] = useChartSettingStore(
    useShallow((state) => [
      state.showLabel,
      state.setShowLabel,
      state.showAmount,
      state.setShowAmount,
      state.showTransactionInfo,
      state.setShowTransactionInfo,
      state.showOutputField,
      state.setShowOutputField,
      state.lockZoomToXAxis,
      state.setLockZoomToXAxis,
      state.showFiatOnChart,
      state.setShowFiatOnChart,
      state.showFiatAtTxTime,
      state.setShowFiatAtTxTime,
      state.showFiatPercentageChange,
      state.setShowFiatPercentageChange,
      state.showHistoricalFiatLine,
      state.setShowHistoricalFiatLine,
      state.showTransactionFlowChart,
      state.setShowTransactionFlowChart,
      state.showUtxoFlowChart,
      state.setShowUtxoFlowChart
    ])
  )

  const [selectedShowLabel, setSelectedShowLabel] = useState(showLabel)
  const [selectedShowAmount, setSelectedShowAmount] = useState(showAmount)
  const [selectedShowTransactionInfo, setSelectedShowTransactionInfo] =
    useState(showTransactionInfo)
  const [selectedShowOutputField, setSelectedShowOutputField] =
    useState(showOutputField)
  const [selectedShowFiatOnChart, setSelectedShowFiatOnChart] =
    useState(showFiatOnChart)
  const [selectedShowFiatAtTxTime, setSelectedShowFiatAtTxTime] =
    useState(showFiatAtTxTime)
  const [
    selectedShowFiatPercentageChange,
    setSelectedShowFiatPercentageChange
  ] = useState(showFiatPercentageChange)
  const [selectedShowHistoricalFiatLine, setSelectedShowHistoricalFiatLine] =
    useState(showHistoricalFiatLine)
  const [selectedLockZoomToXAxis, setSelectedLockZoomToXAxis] =
    useState(lockZoomToXAxis)
  const [
    selectedShowTransactionFlowChart,
    setSelectedShowTransactionFlowChart
  ] = useState(showTransactionFlowChart)
  const [selectedShowUtxoFlowChart, setSelectedShowUtxoFlowChart] =
    useState(showUtxoFlowChart)

  const missingFiatData = missingHistoricalFiatData({
    fetchCurrentPrices: showCurrentFiat,
    fetchHistoricalPrices: showHistoricalFiat
  })
  const historicalFiatDisabled = missingFiatData !== null

  function handleOnSave() {
    setLockZoomToXAxis(selectedLockZoomToXAxis)
    setShowAmount(selectedShowAmount)
    setShowFiatAtTxTime(selectedShowFiatAtTxTime)
    setShowFiatOnChart(selectedShowFiatOnChart)
    setShowFiatPercentageChange(selectedShowFiatPercentageChange)
    setShowHistoricalFiatLine(selectedShowHistoricalFiatLine)
    setShowLabel(selectedShowLabel)
    setShowOutputField(selectedShowOutputField)
    setShowTransactionFlowChart(selectedShowTransactionFlowChart)
    setShowTransactionInfo(selectedShowTransactionInfo)
    setShowUtxoFlowChart(selectedShowUtxoFlowChart)
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.features.charts.pageTitle')}</SSText>
          )
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSSeparator />
            <SSVStack gap="md">
              <SSText weight="bold" uppercase>
                {t('settings.features.charts.historyChart.title')}
              </SSText>
              <SSVStack>
                <SSText>
                  {t('settings.features.charts.historyChart.layers.title')}
                </SSText>
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showLabels'
                  )}
                  selected={selectedShowLabel}
                  onPress={() => setSelectedShowLabel((prev) => !prev)}
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showAmounts'
                  )}
                  selected={selectedShowAmount}
                  onPress={() => setSelectedShowAmount((prev) => !prev)}
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showTransactionInfo'
                  )}
                  selected={selectedShowTransactionInfo}
                  onPress={() =>
                    setSelectedShowTransactionInfo((prev) => !prev)
                  }
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showOutputFields'
                  )}
                  selected={selectedShowOutputField}
                  onPress={() => setSelectedShowOutputField((prev) => !prev)}
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showFiatOnChart'
                  )}
                  selected={selectedShowFiatOnChart}
                  disabled={!showCurrentFiat}
                  onPress={() => {
                    setSelectedShowFiatOnChart((prev) => !prev)
                    if (selectedShowFiatOnChart) {
                      setSelectedShowFiatAtTxTime(false)
                    }
                  }}
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showFiatAtTxTime'
                  )}
                  selected={selectedShowFiatAtTxTime}
                  disabled={historicalFiatDisabled || !selectedShowFiatOnChart}
                  onPress={() => setSelectedShowFiatAtTxTime((prev) => !prev)}
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showHistoricalFiatLine'
                  )}
                  selected={selectedShowHistoricalFiatLine}
                  disabled={historicalFiatDisabled}
                  onPress={() =>
                    setSelectedShowHistoricalFiatLine((prev) => !prev)
                  }
                />
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.layers.showFiatPercentageChange'
                  )}
                  selected={selectedShowFiatPercentageChange}
                  disabled={historicalFiatDisabled}
                  onPress={() =>
                    setSelectedShowFiatPercentageChange((prev) => !prev)
                  }
                />
                {missingFiatData ? (
                  <SSButton
                    label={t(FIAT_DATA_LINK_LABELS[missingFiatData])}
                    variant="outline"
                    onPress={() => router.navigate(FIAT_DATA_SETTINGS_ROUTE)}
                  />
                ) : null}
              </SSVStack>
              <SSVStack>
                <SSText>
                  {t('settings.features.charts.historyChart.navigation.title')}
                </SSText>
                <SSCheckbox
                  label={t(
                    'settings.features.charts.historyChart.navigation.lockZoomXAxis'
                  )}
                  selected={selectedLockZoomToXAxis}
                  onPress={() => setSelectedLockZoomToXAxis((prev) => !prev)}
                />
              </SSVStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="md">
              <SSText weight="bold" uppercase>
                {t('settings.features.charts.transactionFlowChart.title')}
              </SSText>
              <SSCheckbox
                label={t('settings.features.charts.transactionFlowChart.show')}
                selected={selectedShowTransactionFlowChart}
                onPress={() =>
                  setSelectedShowTransactionFlowChart((prev) => !prev)
                }
              />
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="md">
              <SSText weight="bold" uppercase>
                {t('settings.features.charts.utxoBubbles.title')}
              </SSText>
              <SSCheckbox
                label={t('settings.features.charts.utxoBubbles.show')}
                selected={selectedShowUtxoFlowChart}
                onPress={() => setSelectedShowUtxoFlowChart((prev) => !prev)}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={() => handleOnSave()}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
