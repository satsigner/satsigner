import { Canvas, Rect, Text, useFont } from '@shopify/react-native-skia'
import { useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import type { MemPoolBlock } from '@/types/models/Blockchain'
import { formatBytes } from '@/utils/format'

const CANVAS_HEIGHT = 200
const BLOCK_GAP = 8
const BLOCK_MIN_HEIGHT = 20

type SSMempoolBlocksProps = {
  blocks: MemPoolBlock[]
}

function feeRateColor(medianFee: number): string {
  if (medianFee >= 100) {
    return '#ff4444'
  }
  if (medianFee >= 30) {
    return '#ff9900'
  }
  if (medianFee >= 5) {
    return '#f0c040'
  }
  return Colors.mainGreen
}

export default function SSMempoolBlocks({ blocks }: SSMempoolBlocksProps) {
  const { width } = useWindowDimensions()
  const font = useFont(require('@/assets/fonts/SF-Pro-Text-Regular.otf'), 10)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (blocks.length === 0) {
    return null
  }

  const displayBlocks = blocks.slice(0, 8)
  const maxVSize = Math.max(...displayBlocks.map((b) => b.blockVSize))

  const blockWidth =
    (width - BLOCK_GAP * (displayBlocks.length + 1)) / displayBlocks.length

  const selectedBlock =
    selectedIndex !== null ? displayBlocks[selectedIndex] : null

  return (
    <SSVStack gap="sm">
      <Canvas style={{ height: CANVAS_HEIGHT, width }}>
        {displayBlocks.map((block, i) => {
          const normalizedHeight =
            BLOCK_MIN_HEIGHT +
            (block.blockVSize / maxVSize) *
              (CANVAS_HEIGHT - BLOCK_MIN_HEIGHT - 40)
          const x = BLOCK_GAP + i * (blockWidth + BLOCK_GAP)
          const y = CANVAS_HEIGHT - normalizedHeight - 20
          const color = feeRateColor(block.medianFee)
          const isSelected = selectedIndex === i

          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={blockWidth}
              height={normalizedHeight}
              color={isSelected ? Colors.white : color}
              opacity={isSelected ? 1 : 0.8}
            />
          )
        })}

        {/* Fee rate labels */}
        {font &&
          displayBlocks.map((block, i) => {
            const x = BLOCK_GAP + i * (blockWidth + BLOCK_GAP)
            const labelText = `${block.medianFee}`
            return (
              <Text
                key={i}
                x={x + 2}
                y={CANVAS_HEIGHT - 6}
                text={labelText}
                font={font}
                color={Colors.gray['400']}
              />
            )
          })}
      </Canvas>

      {/* Touch overlay for block selection */}
      <View style={[StyleSheet.absoluteFillObject, { height: CANVAS_HEIGHT }]}>
        <SSHStack gap="none" style={{ height: CANVAS_HEIGHT }}>
          {displayBlocks.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={{ flex: 1, height: CANVAS_HEIGHT }}
              onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
            />
          ))}
        </SSHStack>
      </View>

      <SSText
        size="xxs"
        style={{ color: Colors.gray['500'], textAlign: 'center' }}
      >
        sat/vB labels · tap block for details
      </SSText>

      {selectedBlock && (
        <SSVStack gap="xs" style={styles.selectedInfo}>
          <SSHStack justifyBetween>
            <SSText size="xs" style={styles.infoLabel}>
              Transactions
            </SSText>
            <SSText size="xs" style={styles.infoValue}>
              {selectedBlock.nTx.toLocaleString()}
            </SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText size="xs" style={styles.infoLabel}>
              Size
            </SSText>
            <SSText size="xs" style={styles.infoValue}>
              {formatBytes(selectedBlock.blockVSize)}
            </SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText size="xs" style={styles.infoLabel}>
              Median fee
            </SSText>
            <SSText size="xs" style={styles.infoValue}>
              {selectedBlock.medianFee} sat/vB
            </SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText size="xs" style={styles.infoLabel}>
              Fee range
            </SSText>
            <SSText size="xs" style={styles.infoValue}>
              {selectedBlock.feeRange[0]}–{selectedBlock.feeRange.at(-1)} sat/vB
            </SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText size="xs" style={styles.infoLabel}>
              Total fees
            </SSText>
            <SSText size="xs" style={styles.infoValue}>
              {selectedBlock.totalFees.toLocaleString()} sats
            </SSText>
          </SSHStack>
        </SSVStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  infoLabel: { color: Colors.gray['400'] },
  infoValue: { color: Colors.gray['100'] },
  selectedInfo: {
    backgroundColor: Colors.gray['900'],
    borderColor: Colors.gray['700'],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  }
})
