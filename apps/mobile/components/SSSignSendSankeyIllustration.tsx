import { useWindowDimensions, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

import { Colors } from '@/styles'

const VB_W = 360
const VB_H = 520

/** Center “transaction” column — all inputs meet the left face, all outputs leave the right face. */
const TX_LEFT = 168
const TX_RIGHT = 206

/** Top of transaction rect; height === ∑ribbon h (both sides). */
const TX_RECT_TOP = 157

/** All input ribbons share this left edge; all output ribbons share this right edge. */
const RIBBON_IN_LEFT_X = 0
const RIBBON_OUT_RIGHT_X = VB_W

/** Same as `SSIntroAnimation` overlay — input ribbons fade up from this at the outer left. */
const PAGE_BACKGROUND = Colors.gray[950]

/**
 * Center transaction rect + output ribbons; keep in sync with input gradient end (`NODE_FILL_OPACITY`).
 */
const NODE_FILL = 'rgba(255,255,255,0.09)'

const NODE_FILL_OPACITY = 0.09

/** Extra stops ease banding; use `userSpaceOnUse` so every ribbon shares one gradient (fewer cross-lane streaks). */
const INPUT_GRADIENT_STOPS: readonly {
  offset: string
  stopColor: string
  stopOpacity: number
}[] = [
  { offset: '0', stopColor: PAGE_BACKGROUND, stopOpacity: 1 },
  { offset: '0.22', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.25 },
  { offset: '0.5', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.55 },
  { offset: '0.78', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.82 },
  { offset: '1', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY }
]

const OUTPUT_GRADIENT_STOPS: readonly {
  offset: string
  stopColor: string
  stopOpacity: number
}[] = [
  { offset: '0', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY },
  { offset: '0.22', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.82 },
  { offset: '0.5', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.55 },
  { offset: '0.78', stopColor: '#FFFFFF', stopOpacity: NODE_FILL_OPACITY * 0.25 },
  { offset: '1', stopColor: PAGE_BACKGROUND, stopOpacity: 1 }
]

const INPUT_RIBBON_GRADIENT_ID = 'ssSignSendInputRibbonGrad'
const OUTPUT_RIBBON_GRADIENT_ID = 'ssSignSendOutputRibbonGrad'

function sumLaneHeights(hs: readonly number[]): number {
  let s = 0
  for (let i = 0; i < hs.length; i++) {
    s += hs[i]
  }
  return s
}

/** Per-lane thickness at the left face (order top → bottom). */
const INPUT_LANE_HS = [8, 29, 9, 24, 10, 6] as const
/** Per-lane thickness at the right face (4 lanes — top pair 14+8 merged). ∑h matches inputs. */
const OUTPUT_LANE_HS = [22, 24, 32, 8] as const

const TX_TOTAL_H = sumLaneHeights(INPUT_LANE_HS)
if (sumLaneHeights(OUTPUT_LANE_HS) !== TX_TOTAL_H) {
  throw new Error(
    `Sankey illustration: INPUT ∑h (${TX_TOTAL_H}) must equal OUTPUT ∑h (${sumLaneHeights(OUTPUT_LANE_HS)})`
  )
}

type TxSlot = {
  h: number
  ty: number
}

function stackTxSlots(hs: readonly number[], topY: number): TxSlot[] {
  let y = topY
  return hs.map((h) => {
    const ty = y + h / 2
    y += h
    return { h, ty }
  })
}

const INPUT_TX_SLOTS = stackTxSlots(INPUT_LANE_HS, TX_RECT_TOP)
const OUTPUT_TX_SLOTS = stackTxSlots(OUTPUT_LANE_HS, TX_RECT_TOP)

type RibbonBias = {
  b0: number
  b1: number
}

type InputRibbon = {
  bias: RibbonBias
  key: string
  slot: number
  sy: number
}

type OutputRibbon = {
  bias: RibbonBias
  key: string
  slot: number
  sy: number
}

/**
 * Sankey link–style ribbon; b0/b1 skew the horizontal control anchors (more variation than fixed 0.52/0.48).
 * `h` is the full band thickness at both ends (constant-width ribbon).
 */
function ribbonPath(
  sx: number,
  sy: number,
  h: number,
  tx: number,
  ty: number,
  b0: number,
  b1: number
): string {
  const half = h / 2
  const top0 = sy - half
  const bot0 = sy + half
  const top1 = ty - half
  const bot1 = ty + half
  const span = tx - sx
  const cx0 = sx + span * b0
  const cx1 = sx + span * b1
  return [
    `M ${sx} ${top0}`,
    `C ${cx0} ${top0} ${cx1} ${top1} ${tx} ${top1}`,
    `L ${tx} ${bot1}`,
    `C ${cx1} ${bot1} ${cx0} ${bot0} ${sx} ${bot0}`,
    'Z'
  ].join(' ')
}

/**
 * Inputs: left edges aligned; vertical scatter and asymmetric beziers vary per lane.
 */
const INPUT_RIBBONS: InputRibbon[] = [
  { bias: { b0: 0.38, b1: 0.62 }, key: 'in-a', slot: 0, sy: 62 },
  { bias: { b0: 0.58, b1: 0.4 }, key: 'in-b', slot: 1, sy: 118 },
  { bias: { b0: 0.45, b1: 0.55 }, key: 'in-c', slot: 2, sy: 178 },
  { bias: { b0: 0.52, b1: 0.44 }, key: 'in-d', slot: 3, sy: 258 },
  { bias: { b0: 0.41, b1: 0.59 }, key: 'in-e', slot: 4, sy: 322 },
  { bias: { b0: 0.6, b1: 0.38 }, key: 'in-f', slot: 5, sy: 402 }
]

/**
 * Outputs: four ribbons — top two former lanes merged (22px) plus one 32px band vs six inputs.
 */
const OUTPUT_RIBBONS: OutputRibbon[] = [
  { bias: { b0: 0.42, b1: 0.58 }, key: 'out-a', slot: 0, sy: 88 },
  { bias: { b0: 0.5, b1: 0.46 }, key: 'out-b', slot: 1, sy: 195 },
  { bias: { b0: 0.39, b1: 0.6 }, key: 'out-c', slot: 2, sy: 298 },
  { bias: { b0: 0.47, b1: 0.54 }, key: 'out-d', slot: 3, sy: 385 }
]

function SSSignSendSankeyIllustration() {
  const { height, width } = useWindowDimensions()
  const svgH = Math.min(height * 0.62, VB_H * 1.2)

  return (
    <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
      <Svg
        height={svgH}
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width={width}
      >
        <Defs>
          <LinearGradient
            gradientUnits="userSpaceOnUse"
            id={INPUT_RIBBON_GRADIENT_ID}
            x1={RIBBON_IN_LEFT_X}
            x2={TX_LEFT}
            y1={0}
            y2={0}
          >
            {INPUT_GRADIENT_STOPS.map((s, i) => (
              <Stop
                key={`in-g-${i}`}
                offset={s.offset}
                stopColor={s.stopColor}
                stopOpacity={s.stopOpacity}
              />
            ))}
          </LinearGradient>
          <LinearGradient
            gradientUnits="userSpaceOnUse"
            id={OUTPUT_RIBBON_GRADIENT_ID}
            x1={TX_RIGHT}
            x2={RIBBON_OUT_RIGHT_X}
            y1={0}
            y2={0}
          >
            {OUTPUT_GRADIENT_STOPS.map((s, i) => (
              <Stop
                key={`out-g-${i}`}
                offset={s.offset}
                stopColor={s.stopColor}
                stopOpacity={s.stopOpacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect
          fill={NODE_FILL}
          height={TX_TOTAL_H}
          width={TX_RIGHT - TX_LEFT}
          x={TX_LEFT}
          y={TX_RECT_TOP}
        />
        {INPUT_RIBBONS.map((r) => {
          const slot = INPUT_TX_SLOTS[r.slot]
          return (
            <Path
              key={r.key}
              d={ribbonPath(
                RIBBON_IN_LEFT_X,
                r.sy,
                slot.h,
                TX_LEFT,
                slot.ty,
                r.bias.b0,
                r.bias.b1
              )}
              fill={`url(#${INPUT_RIBBON_GRADIENT_ID})`}
              stroke="none"
            />
          )
        })}
        {OUTPUT_RIBBONS.map((r) => {
          const slot = OUTPUT_TX_SLOTS[r.slot]
          return (
            <Path
              key={r.key}
              d={ribbonPath(
                TX_RIGHT,
                slot.ty,
                slot.h,
                RIBBON_OUT_RIGHT_X,
                r.sy,
                r.bias.b0,
                r.bias.b1
              )}
              fill={`url(#${OUTPUT_RIBBON_GRADIENT_ID})`}
              stroke="none"
            />
          )
        })}
      </Svg>
    </View>
  )
}

export default SSSignSendSankeyIllustration
