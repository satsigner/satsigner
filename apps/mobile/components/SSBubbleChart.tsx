import { Canvas, Group, useFonts } from '@shopify/react-native-skia'
import { hierarchy, type HierarchyCircularNode, pack } from 'd3'
import { useEffect, useMemo, useState } from 'react'
import {
  type GestureResponderEvent,
  Platform,
  type StyleProp,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

import SSBubble from './SSBubble'

type UtxoListItem = Utxo & {
  id: string
  children: []
}

type UtxoListBubble = Partial<Utxo> & {
  id: string
  value: number
  children: UtxoListBubble[]
}

type SSBubbleChartProps = {
  canvasSize: {
    width: number
    height: number
  }
  utxos: Utxo[]
  inputs: Utxo[]
  onPress: (utxo: Utxo) => void
  showOnlySelected?: boolean
  dimUnselected?: boolean
  style?: StyleProp<ViewStyle>
}

function SSBubbleChart({
  canvasSize,
  utxos,
  inputs,
  onPress,
  showOnlySelected = false,
  dimUnselected = false,
  style
}: SSBubbleChartProps) {
  const { height, width } = canvasSize
  const centerX = width / 2
  const centerY = height / 2
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })
  const [utxoList, setUtxoList] = useState<UtxoListItem[]>([])

  useEffect(() => {
    setUtxoList(
      utxos.map((utxo) => ({
        addressTo: utxo.addressTo || '',
        children: [],
        id: `${utxo.txid}:${utxo.vout}`,
        keychain: utxo.keychain,
        label: utxo.label || '',
        timestamp: utxo.timestamp,
        txid: utxo.txid,
        value: utxo.value,
        vout: utxo.vout
      }))
    )
  }, [utxos])

  const utxoPack = useMemo(() => {
    const utxoHierarchy = () =>
      hierarchy<UtxoListBubble>({
        children: utxoList,
        id: 'root',
        value: utxoList.reduce((acc, cur) => acc + cur.value, 0)
      })
        .sum((d) => d?.value ?? 0)
        .sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0))

    const createPack = pack<UtxoListBubble>().size([width, height]).padding(4)

    const allLeaves = createPack(utxoHierarchy()).leaves()

    if (showOnlySelected && inputs.length > 0) {
      const inputOutpoints = new Set(
        inputs.map((input) => `${input.txid}:${input.vout}`)
      )
      return allLeaves.filter((leaf) =>
        inputOutpoints.has(`${leaf.data.txid}:${leaf.data.vout}`)
      )
    }

    return allLeaves
  }, [width, height, utxoList, showOnlySelected, inputs])

  const { width: w, height: h, center, onCanvasLayout } = useLayout()
  const { animatedStyle, gestures, transform, isZoomedIn, scale } = useGestures(
    {
      center,
      height: h,
      isDoubleTapEnabled: true,
      maxPanPointers: Platform.OS === 'ios' ? 2 : 1,
      maxScale: 1000,
      minPanPointers: 1,
      minScale: 0.1,
      width: w
    }
  )

  function handleOnPressCircle(
    event: GestureResponderEvent,
    packedUtxo: HierarchyCircularNode<UtxoListBubble>
  ) {
    const rSquared = packedUtxo.r * packedUtxo.r
    const touchPointX = event.nativeEvent.locationX
    const touchPointY = event.nativeEvent.locationY
    const distanceSquared =
      (touchPointX - packedUtxo.r) ** 2 + (touchPointY - packedUtxo.r) ** 2

    if (distanceSquared <= rSquared) {
      onPress({
        addressTo: packedUtxo.data.addressTo,
        keychain: packedUtxo.data.keychain!,
        label: packedUtxo.data.label || '',
        timestamp: packedUtxo.data.timestamp,
        txid: packedUtxo.data.txid!,
        value: packedUtxo.data.value,
        vout: packedUtxo.data.vout!
      })
    }
  }

  return (
    <View style={style}>
      <View onLayout={onCanvasLayout}>
        <Canvas style={canvasSize}>
          <Group transform={transform} origin={{ x: centerX, y: centerY }}>
            {utxoPack.map((packedUtxo, index) => {
              const utxo: Utxo = {
                addressTo: packedUtxo.data.addressTo,
                keychain: packedUtxo.data.keychain!,
                label: packedUtxo.data.label || '',
                timestamp: packedUtxo.data.timestamp,
                txid: packedUtxo.data.txid!,
                value: packedUtxo.data.value!,
                vout: packedUtxo.data.vout!
              }

              const isSelected = inputs.some(
                (input: Utxo) =>
                  getUtxoOutpoint(input) === getUtxoOutpoint(utxo)
              )

              return (
                <SSBubble
                  key={packedUtxo.data.id}
                  utxo={utxo}
                  x={packedUtxo.x}
                  y={packedUtxo.y}
                  radius={packedUtxo.r}
                  selected={isSelected}
                  isZoomedIn={isZoomedIn}
                  customFontManager={customFontManager}
                  scale={scale}
                  animationDelay={index * 50}
                  dimmed={dimUnselected && !isSelected}
                />
              )
            })}
          </Group>
        </Canvas>
      </View>
      <GestureDetector gesture={gestures}>
        <View
          style={{
            bottom: 0,
            flex: 1,
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0
          }}
        >
          <Animated.View
            style={[canvasSize, animatedStyle]}
            onLayout={onCanvasLayout}
          >
            {utxoPack.map((packedUtxo) => {
              const style = {} as {
                [key: string]: number
              }
              const width = packedUtxo.r * 2
              const height = packedUtxo.r * 2
              const left = packedUtxo.x - packedUtxo.r
              const top = packedUtxo.y - packedUtxo.r
              const borderRadius = packedUtxo.r

              if (width) {
                style.width = width
              }
              if (height) {
                style.height = height
              }
              if (left) {
                style.left = left
              }
              if (top) {
                style.top = top
              }
              if (borderRadius) {
                style.borderRadius = borderRadius
              }

              return (
                <TouchableOpacity
                  key={packedUtxo.data.id}
                  style={{
                    ...style,
                    backgroundColor: 'transparent',
                    overflow: 'hidden',
                    position: 'absolute'
                  }}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={(event) => handleOnPressCircle(event, packedUtxo)}
                >
                  <Animated.View />
                </TouchableOpacity>
              )
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

export default SSBubbleChart
