import { useHeaderHeight } from '@react-navigation/elements'
import { Canvas, Group, useFonts } from '@shopify/react-native-skia'
import { hierarchy, pack, style } from 'd3'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { memo, useCallback, useMemo } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import {
  GestureDetector,
  GestureHandlerRootView,
  GestureStateChangeEvent,
  TapGestureHandlerEventPayload
} from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSUtxoBubble from '@/components/SSUtxoBubble'
import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
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
  const accountStore = useAccountStore()
  const transactionBuilderStore = useTransactionBuilderStore()
  const priceStore = usePriceStore()

  const { id } = useLocalSearchParams<AccountSearchParams>()

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()

  const hasSelectedUtxos = transactionBuilderStore.inputs.size > 0

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

  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const canvasSize = { width: GRAPH_WIDTH, height: GRAPH_HEIGHT }

  const utxoList = accountStore.currentAccount.utxos.map((utxo) => {
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
      const includesInput = transactionBuilderStore.hasInput(utxo)

      if (includesInput) transactionBuilderStore.removeInput(utxo)
      else transactionBuilderStore.addInput(utxo)
    },
    [transactionBuilderStore]
  )

  const onSingleTap = useCallback(
    (event: GestureStateChangeEvent<TapGestureHandlerEventPayload>) => {
      const { x, y } = event
      const tappedUtxo = utxoPack.find((packedUtxo) => {
        const dx = x - packedUtxo.x
        const dy = y - packedUtxo.y
        return dx * dx + dy * dy <= packedUtxo.r * packedUtxo.r
      })

      if (tappedUtxo) {
        handleOnToggleSelected({
          txid: tappedUtxo.data.txid!,
          vout: tappedUtxo.data.vout!,
          value: tappedUtxo.data.value!,
          timestamp: tappedUtxo.data.timestamp,
          label: tappedUtxo.data.label,
          addressTo: tappedUtxo.data.addressTo,
          keychain: tappedUtxo.data.keychain!
        })
      }
    },
    [utxoPack, handleOnToggleSelected]
  )
  const { animatedStyle, gestures, transform, descriptionOpacity } =
    useGestures({
      width: w,
      height: h,
      center,
      isDoubleTapEnabled: true,
      maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
      minPanPointers: 1,
      maxScale: 1000,
      minScale: 0.1,
      onSingleTap
    })
  const centerX = canvasSize.width / 2
  const centerY = canvasSize.height / 2

  // const handleOnPressCircle = useCallback(
  //   (r: number, utxo: Utxo) => {
  //     const rSquared = r * r // Pre-calculate r squared
  //     return (event: GestureResponderEvent) => {
  //       const touchPointX = event.nativeEvent.locationX
  //       const touchPointY = event.nativeEvent.locationY
  //       const distanceSquared =
  //         Math.pow(touchPointX - r, 2) + Math.pow(touchPointY - r, 2)
  //       // Compare squared distances to avoid using Math.sqrt()
  //       if (distanceSquared <= rSquared) {
  //         handleOnToggleSelected(utxo)
  //       }
  //     }
  //   },
  //   [handleOnToggleSelected]
  // )

  function handleSelectAllUtxos() {
    for (const utxo of accountStore.currentAccount.utxos) {
      transactionBuilderStore.addInput(utxo)
    }
  }

  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })
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
                router.navigate(
                  `/accountList/account/${id}/signAndSend/selectUtxoList`
                )
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
                {transactionBuilderStore.inputs.size}{' '}
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

              const selected = transactionBuilderStore
                .getInputs()
                .some(
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
                  descriptionOpacity={descriptionOpacity}
                  customFontManager={customFontManager}
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
              {utxoPack.map((packedUtxo) => (
                <View
                  // <View
                  key={packedUtxo.data.id}
                  // hitSlop={0}
                  // pressRetentionOffset={0}
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
                  // onPress={handleOnPressCircle(packedUtxo.r, {
                  //   txid: packedUtxo.data.txid!,
                  //   vout: packedUtxo.data.vout!,
                  //   value: packedUtxo.data.value,
                  //   timestamp: packedUtxo.data.timestamp,
                  //   label: packedUtxo.data.label,
                  //   addressTo: packedUtxo.data.addressTo,
                  //   keychain: packedUtxo.data.keychain!
                  // })}
                >
                  <Animated.View />
                  {/* </Pressable> */}
                </View>
              ))}
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
            />
            <SSButton
              label={i18n.t('signAndSend.selectAll')}
              variant="ghost"
              style={{ width: 'auto', height: 'auto' }}
              onPress={() => handleSelectAllUtxos()}
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
