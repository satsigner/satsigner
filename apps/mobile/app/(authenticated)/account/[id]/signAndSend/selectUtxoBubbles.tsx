import { useHeaderHeight } from '@react-navigation/elements'
import { Canvas, Group, useFonts } from '@shopify/react-native-skia'
import { hierarchy, HierarchyCircularNode, pack } from 'd3'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo, useState } from 'react'
import {
  GestureResponderEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import { SSIconList } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSUtxoBubble from '@/components/SSUtxoBubble'
import { useGestures } from '@/hooks/useGestures'
import { useGetAccount } from '@/hooks/useGetAccount'
import { useLayout } from '@/hooks/useLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

type UtxoListBubble = Partial<Utxo> & {
  id: string
  value: number
  children: UtxoListBubble[]
}

export default memo(SelectUtxoBubbles)

function SelectUtxoBubbles() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [inputs, getInputs, hasInput, addInput, removeInput] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.getInputs,
        state.hasInput,
        state.addInput,
        state.removeInput
      ])
    )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const { data: account } = useGetAccount(id)

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()

  const [customAmountModalVisible, setCustomAmountModalVisible] = useState(true)

  const hasSelectedUtxos = inputs.size > 0
  const selectedAllUtxos = inputs.size === account.utxos.length

  const utxosValue = useCallback(
    (utxos: Utxo[]): number => utxos.reduce((acc, utxo) => acc + utxo.value, 0),
    []
  )

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos, utxosValue]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const canvasSize = { width: GRAPH_WIDTH, height: GRAPH_HEIGHT }

  const utxoList = account.utxos.map((utxo) => {
    return {
      id: `${utxo.txid}:${utxo.vout}`,
      children: [],
      value: utxo.value,
      timestamp: utxo.timestamp,
      txid: utxo.txid,
      vout: utxo.vout,
      label: utxo.label || '',
      addressTo: utxo.addressTo || '',
      keychain: utxo.keychain
    }
  })

  const utxoPack = useMemo(() => {
    const utxoHierarchy = () =>
      hierarchy<UtxoListBubble>({
        id: 'root',
        children: utxoList,
        value: utxoList.reduce((acc, cur) => acc + cur.value, 0)
      })
        .sum((d) => d?.value ?? 0)
        .sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0))

    const createPack = pack<UtxoListBubble>()
      .size([GRAPH_WIDTH, GRAPH_HEIGHT])
      .padding(4)

    return createPack(utxoHierarchy()).leaves()
  }, [GRAPH_WIDTH, GRAPH_HEIGHT, utxoList])

  const { width: w, height: h, center, onCanvasLayout } = useLayout()

  const handleOnToggleSelected = useCallback(
    (utxo: Utxo) => {
      const includesInput = hasInput(utxo)

      if (includesInput) removeInput(utxo)
      else addInput(utxo)
    },
    [hasInput, removeInput, addInput]
  )

  const { animatedStyle, gestures, transform, isZoomedIn, scale } = useGestures(
    {
      width: w,
      height: h,
      center,
      isDoubleTapEnabled: true,
      maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
      minPanPointers: 1,
      maxScale: 1000,
      minScale: 0.1
    }
  )
  const centerX = canvasSize.width / 2
  const centerY = canvasSize.height / 2

  function handleSelectAllUtxos() {
    for (const utxo of account.utxos) {
      addInput(utxo)
    }
  }

  function handleDeselectAllUtxos() {
    for (const utxo of account.utxos) {
      removeInput(utxo)
    }
  }

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const handleOnPressCircle = useCallback(
    (packedUtxo: HierarchyCircularNode<UtxoListBubble>) => {
      const rSquared = packedUtxo.r * packedUtxo.r // Pre-calculate r squared
      return (event: GestureResponderEvent) => {
        const touchPointX = event.nativeEvent.locationX
        const touchPointY = event.nativeEvent.locationY
        const distanceSquared =
          Math.pow(touchPointX - packedUtxo.r, 2) +
          Math.pow(touchPointY - packedUtxo.r, 2)

        // Compare squared distances to avoid using Math.sqrt()
        if (distanceSquared <= rSquared) {
          handleOnToggleSelected({
            txid: packedUtxo.data.txid!,
            vout: packedUtxo.data.vout!,
            value: packedUtxo.data.value,
            timestamp: packedUtxo.data.timestamp,
            label: packedUtxo.data.label,
            addressTo: packedUtxo.data.addressTo,
            keychain: packedUtxo.data.keychain!
          })
        }
      }
    },
    [handleOnToggleSelected]
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
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
              <SSIconList height={16} width={24} />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {i18n.t('common.of').toLowerCase()}{' '}
                {account.utxos.length} {i18n.t('common.selected').toLowerCase()}
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
                  {formatNumber(satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {fiatCurrency}
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
                  {formatNumber(satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </LinearGradient>
      <View style={{ position: 'absolute', top: 40 }}>
        <Canvas style={canvasSize} onLayout={onCanvasLayout}>
          <Group transform={transform} origin={{ x: centerX, y: centerY }}>
            {utxoPack.map((packedUtxo) => {
              const utxo: Utxo = {
                txid: packedUtxo.data.txid!,
                vout: packedUtxo.data.vout!,
                value: packedUtxo.data.value!,
                timestamp: packedUtxo.data.timestamp,
                label: packedUtxo.data.label,
                addressTo: packedUtxo.data.addressTo,
                keychain: packedUtxo.data.keychain!
              }

              const selected = getInputs().some(
                (input) => getUtxoOutpoint(input) === getUtxoOutpoint(utxo)
              )

              return (
                <SSUtxoBubble
                  key={packedUtxo.data.id}
                  utxo={utxo}
                  x={packedUtxo.x}
                  y={packedUtxo.y}
                  radius={packedUtxo.r}
                  selected={selected}
                  isZoomedIn={isZoomedIn}
                  customFontManager={customFontManager}
                  scale={scale}
                />
              )
            })}
          </Group>
        </Canvas>
        <GestureDetector gesture={gestures}>
          <View
            style={{
              flex: 1,
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0
            }}
          >
            <Animated.View
              style={[canvasSize, animatedStyle]}
              onLayout={onCanvasLayout}
            >
              {utxoPack.map((packedUtxo) => {
                return (
                  <TouchableOpacity
                    key={packedUtxo.data.id}
                    style={{
                      width: packedUtxo.r * 2,
                      height: packedUtxo.r * 2,
                      position: 'absolute',
                      left: packedUtxo.x - packedUtxo.r,
                      top: packedUtxo.y - packedUtxo.r,
                      borderRadius: packedUtxo.r,
                      overflow: 'hidden',
                      backgroundColor: 'transparent'
                    }}
                    delayPressIn={0}
                    delayPressOut={0}
                    onPress={handleOnPressCircle(packedUtxo)}
                  >
                    <Animated.View />
                  </TouchableOpacity>
                )
              })}
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[styles.absoluteSubmitContainer]}
        colors={['#00000000', '#0000000F', '#0000002A', '#000000']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSHStack justifyBetween>
            <SSButton
              label={i18n.t('signAndSend.customAmount')}
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() => setCustomAmountModalVisible(true)}
            />
            <SSButton
              label={
                selectedAllUtxos
                  ? i18n.t('signAndSend.deselectAll')
                  : i18n.t('signAndSend.selectAll')
              }
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() =>
                selectedAllUtxos
                  ? handleDeselectAllUtxos()
                  : handleSelectAllUtxos()
              }
            />
          </SSHStack>
          <SSButton
            label={i18n.t('signAndSend.addAsInputToMessage')}
            variant="secondary"
            disabled={!hasSelectedUtxos}
            style={[
              { opacity: 100 },
              !hasSelectedUtxos && {
                backgroundColor: Colors.gray[700]
              }
            ]}
            textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/ioPreview`)
            }
          />
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={customAmountModalVisible}
        onClose={() => setCustomAmountModalVisible(false)}
      >
        <SSVStack>
          <SSText size="lg" center style={{ maxWidth: 240 }}>
            TYPE CUSTOM AMOUNT FOR AUTOMATIC SELECTION
          </SSText>
        </SSVStack>
      </SSModal>
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
