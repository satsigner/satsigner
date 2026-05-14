import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'

import { Colors } from '@/styles'

const EXPLORER_BLOCK_SIZE = 36
const EXPLORER_CONNECTOR_W = 16
const EXPLORER_BLOCK_COUNT = 9
const EXPLORER_CHAIN_WIDTH =
  EXPLORER_BLOCK_COUNT * EXPLORER_BLOCK_SIZE +
  (EXPLORER_BLOCK_COUNT - 1) * EXPLORER_CONNECTOR_W
const EXPLORER_TOP_FRACTION = 0.38
const EXPLORER_REVEAL_SCALE = 0.88
const EXPLORER_REVEAL_MS = 550
const EXPLORER_SCAN_MS = 2600
const EXPLORER_SCAN_FADE_IN_PX = 10
const EXPLORER_SCAN_FADE_OUT_PX = 72
const EXPLORER_SCAN_EDGE_FADE_PX = 100

// Pre-defined transaction bars per block [x, y, w, h]
const EXPLORER_TX_DEFS = [
  [
    { h: 3, w: 20, x: 3, y: 4 },
    { h: 3, w: 12, x: 3, y: 10 },
    { h: 3, w: 18, x: 3, y: 16 },
    { h: 3, w: 9, x: 3, y: 22 }
  ],
  [
    { h: 3, w: 15, x: 3, y: 4 },
    { h: 3, w: 24, x: 3, y: 10 },
    { h: 3, w: 11, x: 3, y: 16 },
    { h: 3, w: 19, x: 3, y: 22 },
    { h: 3, w: 13, x: 3, y: 28 }
  ],
  [
    { h: 3, w: 22, x: 3, y: 4 },
    { h: 3, w: 14, x: 3, y: 10 },
    { h: 3, w: 17, x: 3, y: 22 }
  ],
  [
    { h: 3, w: 11, x: 3, y: 4 },
    { h: 3, w: 21, x: 3, y: 10 },
    { h: 3, w: 16, x: 3, y: 16 },
    { h: 3, w: 25, x: 3, y: 22 },
    { h: 3, w: 8, x: 3, y: 28 }
  ],
  [
    { h: 3, w: 18, x: 3, y: 4 },
    { h: 3, w: 10, x: 3, y: 10 },
    { h: 3, w: 14, x: 3, y: 22 },
    { h: 3, w: 23, x: 3, y: 28 }
  ],
  [
    { h: 3, w: 14, x: 3, y: 4 },
    { h: 3, w: 8, x: 3, y: 10 },
    { h: 3, w: 22, x: 3, y: 16 },
    { h: 3, w: 13, x: 3, y: 22 },
    { h: 3, w: 19, x: 3, y: 28 }
  ],
  [
    { h: 3, w: 17, x: 3, y: 4 },
    { h: 3, w: 23, x: 3, y: 10 },
    { h: 3, w: 10, x: 3, y: 16 },
    { h: 3, w: 20, x: 3, y: 22 }
  ],
  [
    { h: 3, w: 25, x: 3, y: 4 },
    { h: 3, w: 13, x: 3, y: 10 },
    { h: 3, w: 15, x: 3, y: 22 },
    { h: 3, w: 9, x: 3, y: 28 },
    { h: 3, w: 18, x: 3, y: 16 }
  ],
  [
    { h: 3, w: 16, x: 3, y: 10 },
    { h: 3, w: 21, x: 3, y: 16 },
    { h: 3, w: 12, x: 3, y: 22 }
  ],
  [
    { h: 3, w: 9, x: 3, y: 4 },
    { h: 3, w: 20, x: 3, y: 10 },
    { h: 3, w: 15, x: 3, y: 16 },
    { h: 3, w: 24, x: 3, y: 22 },
    { h: 3, w: 11, x: 3, y: 28 }
  ],
  [
    { h: 3, w: 19, x: 3, y: 4 },
    { h: 3, w: 11, x: 3, y: 10 },
    { h: 3, w: 23, x: 3, y: 22 },
    { h: 3, w: 14, x: 3, y: 28 }
  ]
] as const

type BlockTxProps = {
  blockLeft: number
  h: number
  scanX: SharedValue<number>
  w: number
  x: number
  y: number
}

function BlockTx({ blockLeft, scanX, x, y, w, h }: BlockTxProps) {
  const style = useAnimatedStyle(() => {
    // localPastBlock = 0 when scan line reaches right edge of block
    const localPastBlock = scanX.value - (blockLeft + EXPLORER_BLOCK_SIZE - 20)
    const fadeIn = Math.min(
      1,
      Math.max(0, localPastBlock / EXPLORER_SCAN_FADE_IN_PX)
    )
    const fadeOut = Math.min(
      1,
      Math.max(
        0,
        (EXPLORER_SCAN_FADE_OUT_PX - localPastBlock) / EXPLORER_SCAN_FADE_OUT_PX
      )
    )
    const t = Math.min(fadeIn, fadeOut)
    return { opacity: 0.1 + t * 0.6 }
  })

  return (
    <Animated.View
      style={[
        styles.explorerTx,
        style,
        { height: h, left: x, top: y, width: w }
      ]}
    />
  )
}

type SSIntroAnimationExplorerStepProps = {
  screenHeight: number
  screenWidth: number
}

function SSIntroAnimationExplorerStep({
  screenWidth,
  screenHeight
}: SSIntroAnimationExplorerStepProps) {
  const revealOpacity = useSharedValue(0)
  const revealScale = useSharedValue(EXPLORER_REVEAL_SCALE)
  const scanX = useSharedValue(0)

  const containerStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ scale: revealScale.value }]
  }))

  const scanStyle = useAnimatedStyle(() => {
    const fadeLeft = Math.min(1, scanX.value / EXPLORER_SCAN_EDGE_FADE_PX)
    const fadeRight = Math.min(
      1,
      (EXPLORER_CHAIN_WIDTH - scanX.value) / EXPLORER_SCAN_EDGE_FADE_PX
    )
    return {
      opacity: 0.8 * Math.min(fadeLeft, fadeRight),
      transform: [{ translateX: scanX.value }]
    }
  })

  const chainLeft = (screenWidth - EXPLORER_CHAIN_WIDTH) / 2
  const chainTop = screenHeight * EXPLORER_TOP_FRACTION

  useEffect(() => {
    revealOpacity.set(withTiming(1, { duration: EXPLORER_REVEAL_MS }))
    revealScale.set(
      withTiming(
        1,
        { duration: EXPLORER_REVEAL_MS, easing: Easing.out(Easing.cubic) },
        () => {
          scanX.set(
            withRepeat(
              withTiming(EXPLORER_CHAIN_WIDTH, {
                duration: EXPLORER_SCAN_MS,
                easing: Easing.linear
              }),
              -1,
              false
            )
          )
        }
      )
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[styles.fullScreen, containerStyle]}
      pointerEvents="none"
    >
      <View style={[styles.explorerChain, { left: chainLeft, top: chainTop }]}>
        {Array.from({ length: EXPLORER_BLOCK_COUNT }).map((_, i) => {
          const blockLeft = i * (EXPLORER_BLOCK_SIZE + EXPLORER_CONNECTOR_W)
          const blockCenterScreen =
            chainLeft + blockLeft + EXPLORER_BLOCK_SIZE / 2
          const edgeFadeLeft = Math.min(
            1,
            Math.max(0, blockCenterScreen / 120)
          )
          const edgeFadeRight = Math.min(
            1,
            Math.max(0, (screenWidth - blockCenterScreen) / 120)
          )
          const edgeFade = Math.max(
            0.32,
            Math.min(edgeFadeLeft, edgeFadeRight)
          )
          return (
            <View key={i} style={[styles.explorerItem, { opacity: edgeFade }]}>
              <View
                style={[
                  styles.explorerBlock,
                  i === Math.floor(EXPLORER_BLOCK_COUNT / 2) &&
                    styles.explorerBlockCenter,
                  Math.abs(i - Math.floor(EXPLORER_BLOCK_COUNT / 2)) === 1 &&
                    styles.explorerBlockNearCenter
                ]}
              >
                {EXPLORER_TX_DEFS[i].map((tx, j) => (
                  <BlockTx
                    key={j}
                    blockLeft={blockLeft}
                    scanX={scanX}
                    x={tx.x}
                    y={tx.y}
                    w={tx.w}
                    h={tx.h}
                  />
                ))}
              </View>
              {i < EXPLORER_BLOCK_COUNT - 1 && (
                <View style={styles.explorerConnector} />
              )}
            </View>
          )
        })}
        <Animated.View style={[styles.explorerScan, scanStyle]} />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  explorerBlock: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderWidth: 1,
    height: EXPLORER_BLOCK_SIZE,
    overflow: 'hidden',
    width: EXPLORER_BLOCK_SIZE
  },
  explorerBlockCenter: {
    borderColor: 'rgba(255,255,255,0.65)'
  },
  explorerBlockNearCenter: {
    borderColor: 'rgba(255,255,255,0.5)'
  },
  explorerChain: {
    alignItems: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'absolute'
  },
  explorerConnector: {
    backgroundColor: Colors.white,
    height: 1,
    opacity: 0.2,
    width: EXPLORER_CONNECTOR_W
  },
  explorerItem: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  explorerScan: {
    backgroundColor: Colors.white,
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 1
  },
  explorerTx: {
    backgroundColor: Colors.white,
    position: 'absolute'
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  }
})

export default SSIntroAnimationExplorerStep
