import {
  Canvas,
  Circle,
  Path,
  Skia,
  Text,
  useFont
} from '@shopify/react-native-skia'
import { useWindowDimensions } from 'react-native'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import { Colors } from '@/styles'
import {
  HALVING_INTERVAL,
  blockSubsidySats,
  halvingEpoch,
  historicalHalvings
} from '@/utils/bitcoin/consensus'

const CANVAS_HEIGHT = 280
const TRACK_RADIUS = 110
const TRACK_WIDTH = 2
const MILESTONE_RADIUS = 3

type SSHalvingProgressProps = {
  height: number
}

export default function SSHalvingProgress({ height }: SSHalvingProgressProps) {
  const { width } = useWindowDimensions()
  const fontCenterLg = useFont(
    require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
    20
  )
  const fontCenterMd = useFont(
    require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
    17
  )
  const fontCenterSm = useFont(
    require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
    13
  )
  const fontSmall = useFont(
    require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
    11
  )

  const epoch = halvingEpoch(height)
  const blocksInEpoch = height - epoch * HALVING_INTERVAL
  const progress = blocksInEpoch / HALVING_INTERVAL
  const subsidyBtc = blockSubsidySats(height) / SATS_PER_BITCOIN

  const fontCenter =
    subsidyBtc >= 1
      ? fontCenterLg
      : subsidyBtc >= 0.1
        ? fontCenterMd
        : fontCenterSm
  const halvings = historicalHalvings()

  const cx = width / 2
  const cy = CANVAS_HEIGHT / 2

  const START_ANGLE = -Math.PI / 2
  const sweepAngle = progress * 2 * Math.PI

  function arcPath(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ): string {
    const x1 = centerX + radius * Math.cos(startAngle)
    const y1 = centerY + radius * Math.sin(startAngle)
    const x2 = centerX + radius * Math.cos(endAngle)
    const y2 = centerY + radius * Math.sin(endAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const trackPath = Skia.Path.MakeFromSVGString(
    arcPath(cx, cy, TRACK_RADIUS, 0, 2 * Math.PI - 0.001)
  )
  const progressPath =
    sweepAngle > 0.01
      ? Skia.Path.MakeFromSVGString(
          arcPath(cx, cy, TRACK_RADIUS, START_ANGLE, START_ANGLE + sweepAngle)
        )
      : null

  const nextHalving = (epoch + 1) * HALVING_INTERVAL
  const blocksRemaining = HALVING_INTERVAL - blocksInEpoch

  const centerLabel = `${subsidyBtc} BTC`
  const epochLabel = `Epoch ${epoch}`
  const percentLabel = `${(progress * 100).toFixed(1)}%`
  const currentBlockLabel = height.toLocaleString()
  const targetBlockLabel = `/ ${nextHalving.toLocaleString()}`
  const blocksToGoLabel = `${blocksRemaining.toLocaleString()} blocks to go`

  const centerLabelWidth = fontCenter ? fontCenter.getTextWidth(centerLabel) : 0
  const epochLabelWidth = fontSmall ? fontSmall.getTextWidth(epochLabel) : 0
  const percentLabelWidth = fontSmall ? fontSmall.getTextWidth(percentLabel) : 0
  const currentBlockLabelWidth = fontSmall
    ? fontSmall.getTextWidth(currentBlockLabel)
    : 0
  const targetBlockLabelWidth = fontSmall
    ? fontSmall.getTextWidth(targetBlockLabel)
    : 0
  const blocksToGoLabelWidth = fontSmall
    ? fontSmall.getTextWidth(blocksToGoLabel)
    : 0

  return (
    <Canvas style={{ height: CANVAS_HEIGHT, width }}>
      {/* Track background */}
      {trackPath && (
        <Path
          path={trackPath}
          color={Colors.gray['800']}
          style="stroke"
          strokeWidth={TRACK_WIDTH}
          strokeCap="round"
        />
      )}

      {/* Progress arc */}
      {progressPath && (
        <Path
          path={progressPath}
          color={Colors.white}
          style="stroke"
          strokeWidth={TRACK_WIDTH}
          strokeCap="round"
        />
      )}

      {/* Milestone dots for past halvings on the track */}
      {halvings.slice(0, epoch + 1).map((h) => {
        const ratio = h.epoch % 1 === 0 && h.epoch > 0 ? 0 : 0
        const angle = START_ANGLE + ratio * 2 * Math.PI
        const mx = cx + TRACK_RADIUS * Math.cos(angle)
        const my = cy + TRACK_RADIUS * Math.sin(angle)
        return (
          <Circle
            key={h.epoch}
            cx={mx}
            cy={my}
            r={MILESTONE_RADIUS}
            color={Colors.white}
          />
        )
      })}

      {/* Center text */}
      {fontSmall && (
        <Text
          x={cx - epochLabelWidth / 2}
          y={cy - 38}
          text={epochLabel}
          font={fontSmall}
          color={Colors.white}
        />
      )}
      {fontCenter && (
        <Text
          x={cx - centerLabelWidth / 2}
          y={cy - 14}
          text={centerLabel}
          font={fontCenter}
          color={Colors.white}
        />
      )}
      {fontSmall && (
        <Text
          x={cx - percentLabelWidth / 2}
          y={cy + 2}
          text={percentLabel}
          font={fontSmall}
          color={Colors.gray['400']}
        />
      )}
      {fontSmall && (
        <Text
          x={cx - (currentBlockLabelWidth + 4 + targetBlockLabelWidth) / 2}
          y={cy + 20}
          text={currentBlockLabel}
          font={fontSmall}
          color={Colors.white}
        />
      )}
      {fontSmall && (
        <Text
          x={
            cx -
            (currentBlockLabelWidth + 4 + targetBlockLabelWidth) / 2 +
            currentBlockLabelWidth +
            4
          }
          y={cy + 20}
          text={targetBlockLabel}
          font={fontSmall}
          color={Colors.gray['500']}
        />
      )}
      {fontSmall && (
        <Text
          x={cx - blocksToGoLabelWidth / 2}
          y={cy + 36}
          text={blocksToGoLabel}
          font={fontSmall}
          color={Colors.gray['600']}
        />
      )}
    </Canvas>
  )
}
