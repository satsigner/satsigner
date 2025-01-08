import { Canvas, Group, useFonts } from '@shopify/react-native-skia'
import { hierarchy, HierarchyCircularNode, pack } from 'd3'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  GestureResponderEvent,
  Platform,
  TouchableOpacity,
  View
} from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'

import { useGestures } from '@/hooks/useGestures'
import { useLayout } from '@/hooks/useLayout'
import { type Utxo } from '@/types/models/Utxo'
import { getUtxoOutpoint } from '@/utils/utxo'

import SSUtxoBubble from './SSUtxoBubble'

type SSUtxoBubblesProps = {
  canvasSize: {
    width: number
    height: number
  }
  utxos: Utxo[]
  inputs: Utxo[]
  onPress: (utxo: Utxo) => void
}

type UtxoListItem = Utxo & {
  id: string
  children: []
}

type UtxoListBubble = Partial<Utxo> & {
  id: string
  value: number
  children: UtxoListBubble[]
}

export function SSUtxoBubbles({
  utxos,
  canvasSize,
  inputs,
  onPress
}: SSUtxoBubblesProps) {
  console.log(utxos)
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
  const [utxoList, setUtxoList] = useState([] as UtxoListItem[])

  useEffect(() => {
    setUtxoList(
      utxos.map((utxo) => {
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
    )
  }, [utxos])

  const utxoPack = useMemo(() => {
    const utxoHierarchy = () =>
      hierarchy<UtxoListBubble>({
        id: 'root',
        children: utxoList,
        value: utxoList.reduce((acc, cur) => acc + cur.value, 0)
      })
        .sum((d) => d?.value ?? 0)
        .sort((a, b) => (b?.value ?? 0) - (a?.value ?? 0))

    const createPack = pack<UtxoListBubble>().size([width, height]).padding(4)

    return createPack(utxoHierarchy()).leaves()
  }, [width, height, utxoList])

  const { width: w, height: h, center, onCanvasLayout } = useLayout()
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

  const handleOnPressCircle = (
    event: GestureResponderEvent,
    packedUtxo: HierarchyCircularNode<UtxoListBubble>
  ) => {
    const rSquared = packedUtxo.r * packedUtxo.r
    const touchPointX = event.nativeEvent.locationX
    const touchPointY = event.nativeEvent.locationY
    const distanceSquared =
      Math.pow(touchPointX - packedUtxo.r, 2) +
      Math.pow(touchPointY - packedUtxo.r, 2)

    if (distanceSquared <= rSquared) {
      onPress({
        txid: packedUtxo.data.txid!,
        vout: packedUtxo.data.vout!,
        value: packedUtxo.data.value,
        timestamp: packedUtxo.data.timestamp,
        label: packedUtxo.data.label || '',
        addressTo: packedUtxo.data.addressTo,
        keychain: packedUtxo.data.keychain!
      })
    }
  }

  return (
    <View style={{ position: 'absolute', top: 40 }}>
      <Canvas style={canvasSize} onLayout={onCanvasLayout}>
        <Group transform={transform} origin={{ x: centerX, y: centerY }}>
          {utxoPack.map((packedUtxo) => {
            const utxo: Utxo = {
              txid: packedUtxo.data.txid!,
              vout: packedUtxo.data.vout!,
              value: packedUtxo.data.value!,
              timestamp: packedUtxo.data.timestamp,
              label: packedUtxo.data.label || '',
              addressTo: packedUtxo.data.addressTo,
              keychain: packedUtxo.data.keychain!
            }

            return (
              <SSUtxoBubble
                key={packedUtxo.data.id}
                utxo={utxo}
                x={packedUtxo.x}
                y={packedUtxo.y}
                radius={packedUtxo.r}
                selected={inputs.some((input: any) => {
                  return getUtxoOutpoint(input) === getUtxoOutpoint(utxo)
                })}
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

              const style = {} as {
                [key: string]: number
              }
              const width = packedUtxo.r * 2
              const height = packedUtxo.r * 2
              const left = packedUtxo.x - packedUtxo.r
              const top = packedUtxo.y - packedUtxo.r
              const borderRadius = packedUtxo.r

              if (width) style.width = width
              if (height) style.height = height
              if (left) style.left = left
              if (top) style.top = top
              if (borderRadius) style.borderRadius = borderRadius

              return (
                <TouchableOpacity
                  key={packedUtxo.data.id}
                  style={{
                    ...style,
                    position: 'absolute',
                    overflow: 'hidden',
                    backgroundColor: 'transparent'
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
