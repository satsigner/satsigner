import { useIsFocused } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'

import { MempoolOracle } from '@/api/blockchain'
import SSButton from '@/components/SSButton'
import SSFeeRateChart from '@/components/SSFeeRateChart'
import SSGradientModal from '@/components/SSGradientModal'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type MempoolStatistics } from '@/types/models/Blockchain'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { time } from '@/utils/time'

export default function FeeSelection() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const isFocused = useIsFocused()

  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const setFeeRate = useTransactionBuilderStore((state) => state.setFeeRate)

  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool[account?.network || 'bitcoin']
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(mempoolUrl),
    [mempoolUrl]
  )

  const [feeSelected, setFeeSelected] = useState(1)
  const [insufficientSatsModalVisible, setInsufficientSatsModalVisible] =
    useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<'2h' | '24h' | '1w'>(
    '24h'
  )

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['statistics', selectedPeriod],
    queryFn: () => mempoolOracle.getMempoolStatistics(selectedPeriod),
    enabled: isFocused,
    staleTime: time.minutes(5)
  })

  function handleOnPressPreviewTxMessage() {
    setFeeRate(feeSelected)
    if (feeSelected > 5000)
      setInsufficientSatsModalVisible(true) // to remove
    else router.navigate(`/account/${id}/signAndSend/previewMessage`)
  }

  const boxPosition = new Animated.Value(feeSelected)

  function handleSliderChange(value: number) {
    setFeeSelected(value)
    const newPosition = (value / 100) * 200
    Animated.timing(boxPosition, {
      toValue: newPosition,
      duration: 100,
      useNativeDriver: true
    }).start()
  }

  const timePeriod = [
    { value: '2h', label: '2 HOURS' },
    { value: '24h', label: '24 HOURS' },
    { value: '1w', label: '1 WEEK' }
  ] as const

  if (!account) return <Redirect href="/" />

  return (
    <>
      <SSMainLayout style={{ paddingHorizontal: 4 }}>
        <SSVStack justifyBetween>
          <SSVStack>
            <SSText
              size="sm"
              weight="bold"
              color="white"
              style={styles.minerFeeLabel}
            >
              {t('transaction.build.minerFee')}
            </SSText>
            <SSHStack gap="lg" style={styles.periodSelector}>
              {timePeriod.map(({ value, label }) => (
                <SSText
                  key={value}
                  size="xs"
                  onPress={() => setSelectedPeriod(value)}
                  color={selectedPeriod === value ? 'white' : 'muted'}
                >
                  {label}
                </SSText>
              ))}
            </SSHStack>
          </SSVStack>
          <View style={styles.outerContainer}>
            <SSFeeRateChart
              mempoolStatistics={mempoolStatistics}
              timeRange={
                selectedPeriod === '1w'
                  ? 'week'
                  : selectedPeriod === '24h'
                    ? 'day'
                    : '2hours'
              }
              boxPosition={boxPosition}
            />
          </View>
          <SSVStack
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16
            }}
          >
            <SSVStack itemsCenter>
              <SSText
                size="4xl"
                weight="medium"
                style={{ marginRight: 4, marginBottom: -16 }}
              >
                {feeSelected}{' '}
                <SSText size="4xl" color="muted">
                  {feeSelected === 1 ? t('bitcoin.satVb') : t('bitcoin.satsVb')}
                </SSText>
              </SSText>

              <SSHStack
                style={{
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  width: '100%'
                }}
              >
                <SSVStack gap="none">
                  <SSText size="md" weight="medium">
                    {formatNumber(feeSelected)}{' '}
                    <SSText size="md" color="muted">
                      {feeSelected > 1 ? t('bitcoin.sats') : t('bitcoin.sat')}
                    </SSText>
                  </SSText>
                </SSVStack>

                <SSText size="md">
                  273{' '}
                  <SSText size="md" color="muted">
                    {t('bitcoin.sats')}
                  </SSText>
                </SSText>

                <SSText size="md">
                  ~ 4{' '}
                  <SSText size="md" color="muted">
                    {t('bitcoin.blocks')}
                  </SSText>
                </SSText>

                <SSText size="md">
                  92{' '}
                  <SSText size="md" color="muted">
                    {t('bitcoin.sats')}
                  </SSText>
                </SSText>
              </SSHStack>
              <SSSlider
                min={1}
                max={1000}
                value={feeSelected}
                step={1}
                onValueChange={handleSliderChange}
              />
            </SSVStack>
            <SSButton
              variant="secondary"
              label={t('transaction.build.set.fee')}
              onPress={() => handleOnPressPreviewTxMessage()}
            />
          </SSVStack>
        </SSVStack>
        <SSGradientModal
          visible={insufficientSatsModalVisible}
          closeText={t('common.cancel')}
          onClose={() => setInsufficientSatsModalVisible(false)}
        >
          <SSVStack style={{ marginTop: 16 }}>
            <SSText color="muted" size="lg" uppercase>
              {t('transaction.build.insufficientSats')}
            </SSText>
          </SSVStack>
          <SSVStack
            itemsCenter
            style={{ marginVertical: 32, width: '100%', paddingHorizontal: 32 }}
          >
            <SSButton label={t('transaction.build.update.outputs')} />
            <SSButton label={t('transaction.build.add.inputs.title.1')} />
            <SSButton label={t('"build.set.highestFeePossible')} />
            <SSButton label={t('transaction.build.set.minimumAutomaticFee')} />
          </SSVStack>
        </SSGradientModal>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  outerContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingRight: 8
  },
  minerFeeLabel: {
    textAlign: 'center',
    width: '100%',
    marginBottom: 12
  },
  periodSelector: {
    justifyContent: 'flex-start',
    paddingHorizontal: 16
  },
  feeContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginVertical: 24
  },
  feeStatsContainer: {
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16
  },
  slider: {
    width: '100%'
  }
})
