import { Canvas, Group } from '@shopify/react-native-skia'
import { hierarchy, type HierarchyCircularNode, pack } from 'd3-hierarchy'
import { useMemo } from 'react'
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
import { useSFProFonts } from '@/hooks/useSFProFonts'
import { type Utxo } from '@/types/models/Utxo'
import { type BubblePackNode, buildBubblePackRoot } from '@/utils/bubblePack'
import { getUtxoOutpoint } from '@/utils/utxo'
import { type UtxoGroupMode } from '@/utils/utxoList'

import SSBubble from './SSBubble'
import SSBubbleGroup from './SSBubbleGroup'

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
  groupMode?: UtxoGroupMode
  style?: StyleProp<ViewStyle>
}

function SSBubbleChart({
  canvasSize,
  utxos,
  inputs,
  onPress,
  showOnlySelected = false,
  dimUnselected = false,
  groupMode = 'none',
  style
}: SSBubbleChartProps) {
  const { height, width } = canvasSize
  const centerX = width / 2
  const centerY = height / 2
  const customFontManager = useSFProFonts()

  const { leaves, groups } = useMemo(() => {
    const root = buildBubblePackRoot(utxos, groupMode)
    const utxoHierarchy = hierarchy<BubblePackNode>(root).sum((d) => d.value)
    // d3 HierarchyNode.sort — not Array.prototype.sort
    // oxlint-disable-next-line eslint-plugin-unicorn/no-array-sort
    utxoHierarchy.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

    const createPack = pack<BubblePackNode>()
      .size([width, height])
      .padding((node) => {
        // Flat pack: keep the pre-grouping tight spacing.
        if (groupMode === 'none') {
          return 4
        }
        // Grouped: more space between group circles, tight within a group.
        return node.depth === 0 ? 10 : 4
      })

    const packed = createPack(utxoHierarchy)
    const allLeaves = packed.leaves().flatMap((leaf) => {
      const { utxo } = leaf.data
      if (!utxo) {
        return []
      }
      return [{ leaf, utxo }]
    })

    if (showOnlySelected && inputs.length > 0) {
      const inputOutpoints = new Set(inputs.map(getUtxoOutpoint))
      return {
        groups: [] as HierarchyCircularNode<BubblePackNode>[],
        leaves: allLeaves.filter(({ utxo }) =>
          inputOutpoints.has(getUtxoOutpoint(utxo))
        )
      }
    }

    const groupNodes =
      groupMode === 'none'
        ? []
        : packed.descendants().filter((node) => node.depth === 1)

    return { groups: groupNodes, leaves: allLeaves }
  }, [width, height, utxos, groupMode, showOnlySelected, inputs])

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
    packedUtxo: HierarchyCircularNode<BubblePackNode>
  ) {
    const { utxo } = packedUtxo.data
    if (!utxo) {
      return
    }

    const rSquared = packedUtxo.r * packedUtxo.r
    const touchPointX = event.nativeEvent.locationX
    const touchPointY = event.nativeEvent.locationY
    const distanceSquared =
      (touchPointX - packedUtxo.r) ** 2 + (touchPointY - packedUtxo.r) ** 2

    if (distanceSquared <= rSquared) {
      onPress(utxo)
    }
  }

  return (
    <View style={style}>
      <View onLayout={onCanvasLayout}>
        <Canvas style={canvasSize}>
          <Group transform={transform} origin={{ x: centerX, y: centerY }}>
            {groups.map((groupNode, index) => (
              <SSBubbleGroup
                key={groupNode.data.id}
                title={groupNode.data.title || ''}
                x={groupNode.x}
                y={groupNode.y}
                radius={groupNode.r}
                customFontManager={customFontManager}
                animationDelay={index * 30}
              />
            ))}
            {leaves.map(({ leaf, utxo }, index) => {
              const isSelected = inputs.some(
                (input: Utxo) =>
                  getUtxoOutpoint(input) === getUtxoOutpoint(utxo)
              )

              return (
                <SSBubble
                  key={leaf.data.id}
                  utxo={utxo}
                  x={leaf.x}
                  y={leaf.y}
                  radius={leaf.r}
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
            {leaves.map(({ leaf }) => {
              const hitStyle = {
                backgroundColor: 'transparent',
                borderRadius: leaf.r,
                height: leaf.r * 2,
                left: leaf.x - leaf.r,
                overflow: 'hidden' as const,
                position: 'absolute' as const,
                top: leaf.y - leaf.r,
                width: leaf.r * 2
              }

              return (
                <TouchableOpacity
                  key={leaf.data.id}
                  style={hitStyle}
                  delayPressIn={0}
                  delayPressOut={0}
                  onPress={(event) => handleOnPressCircle(event, leaf)}
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
