import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useChartSettingStore } from '@/store/chartSettings'

export default function HistoryChart() {
  const router = useRouter()
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
    setLockZoomToXAxis
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
      state.setLockZoomToXAxis
    ])
  )

  const [selectedShowLabel, setSelectedShowLabel] = useState(showLabel)
  const [selectedShowAmount, setSelectedShowAmount] = useState(showAmount)
  const [selectedShowTransactionInfo, setSelectedShowTransactionInfo] =
    useState(showTransactionInfo)
  const [selectedShowOutputField, setSelectedShowOutputField] =
    useState(showOutputField)
  const [selectedLockZoomToXAxis, setSelectedLockZoomToXAxis] =
    useState(lockZoomToXAxis)

  function handleOnSave() {
    setShowLabel(selectedShowLabel)
    setShowAmount(selectedShowAmount)
    setShowTransactionInfo(selectedShowTransactionInfo)
    setShowOutputField(selectedShowOutputField)
    setLockZoomToXAxis(selectedLockZoomToXAxis)
    router.back()
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('settings.features.charts.historyChart.title')}
            </SSText>
          ),
          headerRight: undefined
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
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
                onPress={() => setSelectedShowTransactionInfo((prev) => !prev)}
              />
              <SSCheckbox
                label={t(
                  'settings.features.charts.historyChart.layers.showOutputFields'
                )}
                selected={selectedShowOutputField}
                onPress={() => setSelectedShowOutputField((prev) => !prev)}
              />
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
