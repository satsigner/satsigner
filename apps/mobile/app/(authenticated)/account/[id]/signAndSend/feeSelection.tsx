import { useIsFocused } from '@react-navigation/native'
import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { Polygon, Svg } from 'react-native-svg'

import { MempoolOracle } from '@/api/blockchain'
import SSButton from '@/components/SSButton'
import SSFeeRateChart from '@/components/SSFeeRateChart'
import SSGradientModal from '@/components/SSGradientModal'
import SSSlider from '@/components/SSSlider'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { MempoolStatistics } from '@/types/models/Blockchain'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { time } from '@/utils/time'

export default function FeeSelection() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const isFocused = useIsFocused()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)
  const setFeeRate = useTransactionBuilderStore((state) => state.setFeeRate)

  const account = getCurrentAccount(id!)!

  const [feeSelected, setFeeSelected] = useState(1)
  const [insufficientSatsModalVisible, setInsufficientSatsModalVisible] =
    useState(false)

  const { data: mempoolStatistics } = useQuery<MempoolStatistics[]>({
    queryKey: ['statistics'],
    queryFn: () => new MempoolOracle().getMempoolStatistics('24h'),
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

  const vByteLabels = ['20', '15', '12', '11', '9', '8', '5', '3', '2', '1']

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout style={{ paddingHorizontal: 4 }}>
        <SSVStack justifyBetween>
          <SSHStack gap="lg" style={{ justifyContent: 'space-evenly' }}>
            <SSVStack gap="none">
              <SSText size="md">1 sat/vB</SSText>
              <SSText color="muted" size="xs" center>
                Minimum {'\n'}Fee
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="md">19/300 MB</SSText>
              <SSText color="muted" size="xs" center>
                Mempool {'\n'}Size
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText size="md">1 sat/vB</SSText>
              <SSText color="muted" size="xs" center>
                TXs in {'\n'}Mempool
              </SSText>
            </SSVStack>
          </SSHStack>
          <View style={styles.outerContainer}>
            <SSFeeRateChart mempoolStatistics={mempoolStatistics} />
            <View style={arrowStyles.container}>
              <Animated.View
                style={[
                  arrowStyles.arrow,
                  {
                    transform: [
                      {
                        translateY: boxPosition.interpolate({
                          inputRange: [1, 100],
                          outputRange: [0, -210],
                          extrapolate: 'clamp'
                        })
                      }
                    ]
                  }
                ]}
              >
                <Svg
                  height="40"
                  width="40"
                  viewBox="0 0 100 100"
                  style={arrowStyles.arrow}
                >
                  <Polygon points="0,50 50,25 50,75" fill="white" />
                </Svg>
              </Animated.View>
              <View>
                {vByteLabels.map((label, index) => (
                  <SSText
                    size="xs"
                    key={index}
                    style={[
                      arrowStyles.label,
                      label === '8 sat v/B' ? arrowStyles.highlightLabel : null
                    ]}
                  >
                    {label} {Number(label) > 1 ? 'sats' : 'sat'}/vB
                  </SSText>
                ))}
              </View>
            </View>
          </View>
          <SSVStack
            style={{
              paddingHorizontal: 16,
              paddingBottom: 16
            }}
          >
            <SSVStack itemsCenter>
              <SSHStack
                style={{
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  width: '100%'
                }}
              >
                <SSVStack gap="none">
                  <SSText size="lg" weight="medium">
                    {formatNumber(feeSelected)}{' '}
                    {feeSelected > 1 ? 'sats' : 'sat'}
                  </SSText>
                  <SSText size="xs" color="muted">
                    0.44 USD
                  </SSText>
                </SSVStack>
                <SSText size="lg">~ 4 blocks</SSText>
                <SSText size="lg">1,000 sats/vB</SSText>
              </SSHStack>
              <SSSlider
                min={1}
                max={1000}
                value={feeSelected}
                step={1}
                onValueChange={handleSliderChange}
                style={{
                  width: '100%'
                }}
              />
            </SSVStack>
            <SSButton
              variant="secondary"
              label={i18n.t('feeSelection.previewTxMessage')}
              onPress={() => handleOnPressPreviewTxMessage()}
            />
          </SSVStack>
        </SSVStack>
        <SSGradientModal
          visible={insufficientSatsModalVisible}
          closeText={i18n.t('common.cancel')}
          onClose={() => setInsufficientSatsModalVisible(false)}
        >
          <SSVStack style={{ marginTop: 16 }}>
            <SSText color="muted" size="lg" uppercase>
              Insufficient Sats
            </SSText>
          </SSVStack>
          <SSVStack
            itemsCenter
            style={{ marginVertical: 32, width: '100%', paddingHorizontal: 32 }}
          >
            <SSButton label="Remove or Decrease Outputs" />
            <SSButton label="Add Inputs" />
            <SSButton label="Set Highest Fee Possible" />
            <SSButton label="Set Minimum Automatic Fee" />
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
    marginTop: -20,
    paddingRight: 8
  }
})

const arrowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 10,
    height: 250,
    alignSelf: 'flex-end'
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    marginLeft: -8
  },
  arrow: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -8,
    marginLeft: -10
  },
  label: {
    color: '#6d6d68',
    marginTop: 6
  },
  highlightLabel: {
    color: 'white',
    fontWeight: 'bold'
  }
})
