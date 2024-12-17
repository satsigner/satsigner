import { useHeaderHeight } from '@react-navigation/elements'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from 'react-native-reanimated'

import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import UtxoFlow from '@/components/SSUtxoFlow-copy'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { useEnhancedTransactionBuilderStore } from '@/store/enhancedTransactionBuilder'
import { usePriceStore } from '@/store/price'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { clamp } from '@/utils/worklet'

export default memo(UTXOTransactionFlow)

function UTXOTransactionFlow() {
  const router = useRouter()
  const accountStore = useAccountStore()
  const transactionBuilderStore = useEnhancedTransactionBuilderStore()
  const priceStore = usePriceStore()
  // const blockchainStore = useBlockchainStore()
  const account = useAccountStore()

  const { id } = useLocalSearchParams<AccountSearchParams>()

  const hasSelectedUtxos = useMemo(() => {
    return transactionBuilderStore.getCurrentInputs().length > 0
  }, [transactionBuilderStore])

  const utxosValue = useCallback(
    (utxos: Utxo[]): number => utxos.reduce((acc, utxo) => acc + utxo.value, 0),
    []
  )

  const utxosTotalValue = useMemo(
    () => utxosValue(accountStore.currentAccount.utxos),
    [accountStore.currentAccount.utxos, utxosValue]
  )
  const utxosSelectedValue = useMemo(() => {
    return utxosValue(transactionBuilderStore.getCurrentInputs())
  }, [transactionBuilderStore, utxosValue])

  // Add this to log the transaction details of selected inputs
  const selectedInputDetails = transactionBuilderStore.getCurrentInputDetails()
  console.log('Selected input transaction details:', selectedInputDetails)

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const canvasSize = { width: GRAPH_WIDTH * 1.5, height: GRAPH_HEIGHT } // Reduced from 3 to 1.5
  const centerX = canvasSize.width / 3 // Changed from 4 to 3
  const centerY = canvasSize.height / 2
  const sankeyWidth = canvasSize.width
  const sankeyHeight = canvasSize.height - 200

  // Add shared values for gestures
  const scale = useSharedValue(0.8) // Changed from 0.6 to 0.8
  const savedScale = useSharedValue(0.8)
  const translateX = useSharedValue(-width * 0.4) // Changed from 0.8 to 0.4
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(-width * 0.4)
  const savedTranslateY = useSharedValue(0)

  // Create gesture handlers
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = clamp(savedScale.value * event.scale, 0.5, 2)
    })
    .onEnd(() => {
      savedScale.value = scale.value
    })

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX
      translateY.value = savedTranslateY.value + event.translationY
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const composed = Gesture.Simultaneous(pinchGesture, panGesture)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }))
  const [transactionFlows, setTransactionFlows] = useState<{
    current: {
      inputs: Utxo[]
      outputs: { type: string; value: number }[]
      totalValue: number
      vSize: number
    }
    previous: {
      [transactionId: string]: {
        inputs: Utxo[]
        outputs: { type: string; value: number }[]
        totalValue: number
        vSize: number
      }
    }
  } | null>(null)

  // useEffect(() => {
  //   const fetchTransactionFlows = async () => {
  //     try {
  //       const flows = await transactionBuilderStore.getAllTransactionFlows()
  //       setTransactionFlows(flows)
  //     } catch (error) {
  //       console.error('Error fetching transaction flows:', error)
  //     }
  //   }

  //   fetchTransactionFlows()
  // }, [transactionBuilderStore])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <LinearGradient
        style={styles.absoluteTopContainer}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#000000F5', '#000000A6', '#0000004B', '#00000000']}
      >
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {i18n.t('signAndSend.selectSpendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoList`)
              }
            >
              <Image
                style={{ width: 24, height: 16 }}
                source={require('@/assets/icons/list.svg')}
              />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {transactionBuilderStore.getCurrentInputs().length}{' '}
                {i18n.t('common.of').toLowerCase()}{' '}
                {accountStore.currentAccount.utxos.length}{' '}
                {i18n.t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(priceStore.satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {priceStore.fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue)}
                </SSText>
                <SSText size="xl" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="muted">
                  {formatNumber(priceStore.satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {priceStore.fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </LinearGradient>
      <View style={{ position: 'absolute', flex: 1, top: 100 }}>
        <GestureDetector gesture={composed}>
          <Animated.View
            style={[
              { width: sankeyWidth, height: sankeyHeight },
              animatedStyle
            ]}
          >
            <UtxoFlow
            // width={sankeyWidth}
            // height={sankeyHeight}
            // centerX={centerX}
            // centerY={centerY}
            // walletAddress={formatAddress(
            //   account.currentAccount.address ?? ''
            // )}
            />
          </Animated.View>
        </GestureDetector>
      </View>
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#00000000', '#0000000F', '#0000002A', '#000000']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSHStack justifyBetween style={{ width: '100%' }}>
            <SSButton
              label={i18n.t('signAndSend.addInput')}
              variant="default"
              // disabled={!hasSelectedUtxos}
              style={[
                { opacity: 100, width: '48%' },
                !hasSelectedUtxos && {
                  backgroundColor: Colors.gray[700]
                }
              ]}
              textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
            />
            <SSButton
              label={i18n.t('signAndSend.addOutput')}
              variant="secondary"
              // disabled={!hasSelectedUtxos}
              style={[
                { opacity: 100, width: '48%' },
                !hasSelectedUtxos && {
                  backgroundColor: Colors.gray[700]
                }
              ]}
              textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
            />
          </SSHStack>
          <SSButton
            label={i18n.t('signAndSend.setMessageFee')}
            variant="secondary"
            disabled={!hasSelectedUtxos}
            style={[
              { opacity: 100 },
              !hasSelectedUtxos && {
                backgroundColor: Colors.gray[700]
              }
            ]}
            textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
          />
        </SSVStack>
      </LinearGradient>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  absoluteTopContainer: {
    width: '100%',
    position: 'absolute',
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    zIndex: 20
  },
  absoluteSubmitContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 20
  }
})
