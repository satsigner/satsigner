import { useHeaderHeight } from '@react-navigation/elements'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack } from 'expo-router'
import { memo, useCallback, useMemo } from 'react'
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

import SSText from '@/components/SSText'
import UtxoFlow from '@/components/SSUtxoFlow'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress, formatNumber } from '@/utils/format'

export default memo(UTXOTransactionFlow)

const MINING_FEE_VALUE = 1635

function UTXOTransactionFlow() {
  const accountStore = useAccountsStore()
  const transactionBuilderStore = useTransactionBuilderStore()
  const priceStore = usePriceStore()

  const utxosValue = useCallback(
    (utxos: Utxo[]): number => utxos.reduce((acc, utxo) => acc + utxo.value, 0),
    []
  )

  const utxosTotalValue = useMemo(
    () => utxosValue(accountStore.currentAccount.utxos),
    [accountStore.currentAccount.utxos, utxosValue]
  )
  const utxosSelectedValue = useMemo(() => {
    return utxosValue(transactionBuilderStore.getInputs())
  }, [transactionBuilderStore, utxosValue])

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const canvasSize = { width: GRAPH_WIDTH * 1.5, height: GRAPH_HEIGHT } // Reduced from 3 to 1.5

  const sankeyWidth = canvasSize.width
  const sankeyHeight = canvasSize.height - 200

  // Add animated values for gestures

  const translateX = useSharedValue(-width * 0.4) // Changed from 0.8 to 0.4
  const translateY = useSharedValue(0)
  const savedTranslateX = useSharedValue(-width * 0.4)
  const savedTranslateY = useSharedValue(0)

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX
      translateY.value = savedTranslateY.value + event.translationY
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value
      savedTranslateY.value = translateY.value
    })

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }))
  const inputs = transactionBuilderStore.getInputs()

  const sankeyNodes = useMemo(() => {
    if (inputs.length > 0) {
      const inputNodes = inputs.map((input, index) => ({
        id: String(index + 1),
        indexC: index + 1,
        type: 'text',
        depthH: 1,
        textInfo: [
          `${input.value}`,
          `${formatAddress(input.txid, 3)}`,
          input.label ?? ''
        ],
        value: input.value
      }))

      const blockNode = [
        {
          id: String(inputs?.length + 1),
          indexC: inputs?.length + 1,
          type: 'block',
          depthH: 2,
          textInfo: ['', '', '1533 B', '1509 vB']
        }
      ]

      const miningFee = `${MINING_FEE_VALUE}`
      const priority = '42 sats/vB'
      const outputNodes = [
        {
          id: String(inputs?.length + 2),
          indexC: inputs?.length + 2,
          type: 'text',
          depthH: 3,
          textInfo: [
            'Unspent',
            `${utxosSelectedValue - MINING_FEE_VALUE}`,
            'to'
          ],
          value: utxosSelectedValue - MINING_FEE_VALUE
        },
        {
          id: String(inputs?.length + 3),
          indexC: inputs?.length + 3,
          type: 'text',
          depthH: 3,
          textInfo: [priority, miningFee, 'mining fee'],
          value: MINING_FEE_VALUE
        }
      ]
      return [...inputNodes, ...blockNode, ...outputNodes]
    } else {
      return []
    }
  }, [inputs, utxosSelectedValue])

  const sankeyLinks = useMemo(() => {
    if (inputs.length === 0) return []

    // Create links from each input to the block node
    const inputToBlockLinks = inputs.map((input, index) => ({
      source: String(index + 1),
      target: String(inputs.length + 1), // block node id
      value: input.value
    }))

    // Create links from block node to output nodes
    const blockToOutputLinks = [
      {
        source: String(inputs.length + 1), // from block node
        target: String(inputs.length + 2), // to first output node (Unspent)
        value: utxosSelectedValue - MINING_FEE_VALUE
      },
      {
        source: String(inputs.length + 1), // from block node
        target: String(inputs.length + 3), // to second output node (Mining fee)
        value: MINING_FEE_VALUE
      }
    ]

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [inputs, utxosSelectedValue])

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
          <SSVStack itemsCenter>
            <SSText size="md">
              {i18n.t('signAndSend.addRecipientOutputs')}
            </SSText>
          </SSVStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {transactionBuilderStore.getInputs().length}{' '}
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
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              { width: sankeyWidth, height: sankeyHeight },
              animatedStyle
            ]}
          >
            <UtxoFlow
              sankeyNodes={sankeyNodes}
              sankeyLinks={sankeyLinks}
              inputCount={inputs?.length ?? 0}
            />
          </Animated.View>
        </GestureDetector>
      </View>
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#00000000', '#0000000F', '#0000002A', '#000000']}
      />
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
