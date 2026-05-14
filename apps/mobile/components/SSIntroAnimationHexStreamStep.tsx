import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'

import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'

const HEX_FONT_SIZE = 12
const HEX_LINE_HEIGHT = Math.round(HEX_FONT_SIZE * 1.28)
const HEX_LEFT_PADDING = 8
/** First row top (fraction of screen height); spacing uses `HEX_ROW_GAP_FRAC`. */
const HEX_ROW_TOP_FRAC = 0.1
const HEX_ROW_GAP_FRAC = 0.028
/** Full opacity for each hex line (reveal still fades rows in via `p`). */
const HEX_LINE_BASE_OPACITY = 0.42
// Hex step — uniform fade (all lines at once; easing from hexRowFadeIn)
const HEX_REVEAL_MS = 420
/** Time between hex highlight hops (instant handoff, no fade). */
const HEX_HIGHLIGHT_STEP_MS = 160

const HEX_COL_HEX0 = 10
const HEX_COL_PIPE1 = 60
const HEX_COL_ASCII0 = 61
const HEX_COL_PIPE2 = 77

// Hex dump — Bitcoin genesis block (285 B) as xxd-style offset + hex + ASCII
// (16 bytes / line)
const GENESIS_BLOCK_HEX_ROWS = [
  {
    text: '00000000  01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|'
  },
  {
    text: '00000010  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|'
  },
  {
    text: '00000020  00 00 00 00 3b a3 ed fd 7a 7b 12 b2 7a c7 2c 3e   |....;...z{..z.,>|'
  },
  {
    text: '00000030  67 76 8f 61 7f c8 1b c3 88 8a 51 32 3a 9f b8 aa   |gv.a......Q2:...|'
  },
  {
    text: '00000040  4b 1e 5e 4a 29 ab 5f 49 ff ff 00 1d 1d ac 2b 7c   |K.^J)._I......+||'
  },
  {
    text: '00000050  01 01 00 00 00 01 00 00 00 00 00 00 00 00 00 00   |................|'
  },
  {
    text: '00000060  00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00   |................|'
  },
  {
    text: '00000070  00 00 00 00 00 00 ff ff ff ff 4d 04 ff ff 00 1d   |..........M.....|'
  },
  {
    text: '00000080  01 04 45 54 68 65 20 54 69 6d 65 73 20 30 33 2f   |..EThe Times 03/|'
  },
  {
    text: '00000090  4a 61 6e 2f 32 30 30 39 20 43 68 61 6e 63 65 6c   |Jan/2009 Chancel|'
  },
  {
    text: '000000a0  6c 6f 72 20 6f 6e 20 62 72 69 6e 6b 20 6f 66 20   |lor on brink of |'
  },
  {
    text: '000000b0  73 65 63 6f 6e 64 20 62 61 69 6c 6f 75 74 20 66   |second bailout f|'
  },
  {
    text: '000000c0  6f 72 20 62 61 6e 6b 73 ff ff ff ff 01 00 f2 05   |or banks........|'
  },
  {
    text: "000000d0  2a 01 00 00 00 43 41 04 67 8a fd b0 fe 55 48 27   |*....CA.g....UH'|"
  },
  {
    text: '000000e0  19 67 f1 a6 71 30 b7 10 5c d6 a8 28 e0 39 09 a6   |.g..q0..\\..(.9..|'
  },
  {
    text: '000000f0  79 62 e0 ea 1f 61 de b6 49 f6 bc 3f 4c ef 38 c4   |yb...a..I..?L.8.|'
  },
  {
    text: '00000100  f3 55 04 e5 1e c1 12 de 5c 38 4d f7 ba 0b 8d 57   |.U......\\8M....W|'
  },
  {
    text: '00000110  8a 4c 70 2b 6b f1 1d 5f ac 00 00 00 00            |.Lp+k.._.....   |'
  }
] as const

const GENESIS_ROW_COUNT = GENESIS_BLOCK_HEX_ROWS.length

type GenesisHexTitleKey =
  | 'intro.steps.genesisHex.coinbaseOutpointIndex'
  | 'intro.steps.genesisHex.coinbasePrevTxid'
  | 'intro.steps.genesisHex.headerTimeBitsNonce'
  | 'intro.steps.genesisHex.inputSequence'
  | 'intro.steps.genesisHex.locktime'
  | 'intro.steps.genesisHex.merkleRoot'
  | 'intro.steps.genesisHex.outputCountAndValue'
  | 'intro.steps.genesisHex.previousBlockHash'
  | 'intro.steps.genesisHex.scriptPubKey'
  | 'intro.steps.genesisHex.scriptSig'
  | 'intro.steps.genesisHex.txHeader'
  | 'intro.steps.genesisHex.version'

/** Inclusive byte ranges — full 0..284 partition of the 285 B genesis dump. */
const GENESIS_HEX_HIGHLIGHTS = [
  { byteEnd: 3, byteStart: 0, titleKey: 'intro.steps.genesisHex.version' },
  {
    byteEnd: 35,
    byteStart: 4,
    titleKey: 'intro.steps.genesisHex.previousBlockHash'
  },
  { byteEnd: 67, byteStart: 36, titleKey: 'intro.steps.genesisHex.merkleRoot' },
  {
    byteEnd: 79,
    byteStart: 68,
    titleKey: 'intro.steps.genesisHex.headerTimeBitsNonce'
  },
  { byteEnd: 85, byteStart: 80, titleKey: 'intro.steps.genesisHex.txHeader' },
  {
    byteEnd: 117,
    byteStart: 86,
    titleKey: 'intro.steps.genesisHex.coinbasePrevTxid'
  },
  {
    byteEnd: 121,
    byteStart: 118,
    titleKey: 'intro.steps.genesisHex.coinbaseOutpointIndex'
  },
  { byteEnd: 199, byteStart: 122, titleKey: 'intro.steps.genesisHex.scriptSig' },
  {
    byteEnd: 203,
    byteStart: 200,
    titleKey: 'intro.steps.genesisHex.inputSequence'
  },
  {
    byteEnd: 212,
    byteStart: 204,
    titleKey: 'intro.steps.genesisHex.outputCountAndValue'
  },
  {
    byteEnd: 280,
    byteStart: 213,
    titleKey: 'intro.steps.genesisHex.scriptPubKey'
  },
  { byteEnd: 284, byteStart: 281, titleKey: 'intro.steps.genesisHex.locktime' }
] as const satisfies readonly {
  byteEnd: number
  byteStart: number
  titleKey: GenesisHexTitleKey
}[]

function hexRowFadeIn(t: number) {
  'worklet'
  if (t <= 0) {
    return 0
  }
  if (t >= 1) {
    return 1
  }
  if (t < 0.5) {
    return 4 * t * t * t
  }
  return 1 - Math.pow(-2 * t + 2, 3) / 2
}

function genesisBytesInRow(rowIndex: number): number {
  return rowIndex === GENESIS_ROW_COUNT - 1 ? 13 : 16
}

function genesisRowFirstGlobalByte(rowIndex: number): number {
  return rowIndex * 16
}

type RowByteSpan = { j0: number; j1: number }

function intersectHighlightInRow(
  rowIndex: number,
  byteStart: number,
  byteEnd: number
): RowByteSpan | null {
  const row0 = genesisRowFirstGlobalByte(rowIndex)
  const n = genesisBytesInRow(rowIndex)
  const rowLast = row0 + n - 1
  const lo = Math.max(byteStart, row0)
  const hi = Math.min(byteEnd, rowLast)
  if (lo > hi) {
    return null
  }
  return { j0: lo - row0, j1: hi - row0 }
}

type TextPart = { hl: boolean; text: string }

function pushMerged(out: TextPart[], text: string, hl: boolean) {
  if (text.length === 0) {
    return
  }
  const prev = out[out.length - 1]
  if (prev && prev.hl === hl) {
    prev.text += text
  } else {
    out.push({ hl, text })
  }
}

function hexCharSpanInLine(j0: number, j1: number, bytesInRow: number) {
  const start = HEX_COL_HEX0 + j0 * 3
  const endExclusive = HEX_COL_HEX0 + j1 * 3 + (j1 < bytesInRow - 1 ? 3 : 2)
  return { endExclusive, start }
}

function buildGenesisRowTextParts(
  line: string,
  rowIndex: number,
  highlight: (typeof GENESIS_HEX_HIGHLIGHTS)[number] | null
): TextPart[] {
  const out: TextPart[] = []
  const bytesInRow = genesisBytesInRow(rowIndex)
  const span = highlight
    ? intersectHighlightInRow(rowIndex, highlight.byteStart, highlight.byteEnd)
    : null

  pushMerged(out, line.slice(0, HEX_COL_HEX0), false)

  const hexEnd =
    bytesInRow > 0 ? HEX_COL_HEX0 + bytesInRow * 3 - 1 : HEX_COL_HEX0
  const hexSlice = line.slice(HEX_COL_HEX0, hexEnd)

  if (!span) {
    pushMerged(out, hexSlice, false)
  } else {
    const { j0, j1 } = span
    const { endExclusive: hEnd, start: hStart } = hexCharSpanInLine(
      j0,
      j1,
      bytesInRow
    )
    const rel0 = hStart - HEX_COL_HEX0
    const rel1Exc = hEnd - HEX_COL_HEX0
    pushMerged(out, hexSlice.slice(0, rel0), false)
    pushMerged(out, hexSlice.slice(rel0, rel1Exc), true)
    pushMerged(out, hexSlice.slice(rel1Exc), false)
  }

  pushMerged(out, line.slice(hexEnd, HEX_COL_PIPE1 + 1), false)

  const asciiSlice = line.slice(HEX_COL_ASCII0, HEX_COL_PIPE2)
  if (!span) {
    pushMerged(out, asciiSlice, false)
  } else {
    const { j0, j1 } = span
    pushMerged(out, asciiSlice.slice(0, j0), false)
    pushMerged(out, asciiSlice.slice(j0, j1 + 1), true)
    pushMerged(out, asciiSlice.slice(j1 + 1), false)
  }

  pushMerged(out, line.slice(HEX_COL_PIPE2), false)
  return out
}

type HexRowProps = {
  highlightLead: (typeof GENESIS_HEX_HIGHLIGHTS)[number] | null
  index: number
  revealProgress: SharedValue<number>
  row: (typeof GENESIS_BLOCK_HEX_ROWS)[number]
  screenHeight: number
}

function HexRow({
  row,
  index,
  revealProgress,
  screenHeight,
  highlightLead
}: HexRowProps) {
  const leadParts = useMemo(
    () => buildGenesisRowTextParts(row.text, index, highlightLead),
    [highlightLead, index, row.text]
  )

  const animStyle = useAnimatedStyle(() => {
    const raw = Math.min(1, Math.max(0, revealProgress.value))
    const p = hexRowFadeIn(raw)
    return {
      opacity: HEX_LINE_BASE_OPACITY * p
    }
  })

  const top = (HEX_ROW_TOP_FRAC + index * HEX_ROW_GAP_FRAC) * screenHeight
  const overlayTextProps = {
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.78,
    numberOfLines: 1 as const
  }

  return (
    <Animated.View style={[styles.hexText, animStyle, { top }]}>
      <Text
        {...overlayTextProps}
        style={[styles.hexTextOverlayLine, { color: Colors.white }]}
      >
        {row.text}
      </Text>
      {highlightLead ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <Text {...overlayTextProps} style={styles.hexTextOverlayLine}>
            {leadParts.map((part, i) =>
              part.hl ? (
                <Text key={`hex-ld-${index}-${i}`} style={styles.hexHlTint}>
                  {part.text}
                </Text>
              ) : (
                <Text
                  key={`hex-ldn-${index}-${i}`}
                  style={{ color: 'transparent' }}
                >
                  {part.text}
                </Text>
              )
            )}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

type SSIntroAnimationHexStreamStepProps = {
  screenHeight: number
}

function SSIntroAnimationHexStreamStep({
  screenHeight
}: SSIntroAnimationHexStreamStepProps) {
  const revealProgress = useSharedValue(0)
  const [highlightsEnabled, setHighlightsEnabled] = useState(false)
  const [leadIndex, setLeadIndex] = useState(0)

  const revealDuration = HEX_REVEAL_MS

  useEffect(() => {
    revealProgress.set(
      withTiming(1, {
        duration: revealDuration,
        easing: Easing.linear
      })
    )
  }, [revealDuration, revealProgress])

  useEffect(() => {
    const handle = setTimeout(() => {
      setHighlightsEnabled(true)
    }, revealDuration)
    return () => clearTimeout(handle)
  }, [revealDuration])

  useEffect(() => {
    if (!highlightsEnabled) {
      return
    }
    const id = setInterval(() => {
      setLeadIndex((i) => (i + 1) % GENESIS_HEX_HIGHLIGHTS.length)
    }, HEX_HIGHLIGHT_STEP_MS)
    return () => clearInterval(id)
  }, [highlightsEnabled])

  useEffect(() => {
    return () => {
      cancelAnimation(revealProgress)
    }
  }, [revealProgress])

  const highlightLead = highlightsEnabled
    ? GENESIS_HEX_HIGHLIGHTS[leadIndex]
    : null

  const sectionTitle =
    highlightLead !== null ? t(highlightLead.titleKey) : null

  const labelTop = HEX_ROW_TOP_FRAC * screenHeight - 24

  return (
    <View style={styles.fullScreen} pointerEvents="none">
      {sectionTitle !== null ? (
        <SSText
          center
          size="xs"
          style={[styles.hexSectionLabel, { top: labelTop }]}
        >
          {sectionTitle}
        </SSText>
      ) : null}
      {GENESIS_BLOCK_HEX_ROWS.map((row, i) => (
        <HexRow
          key={`genesis-hex-${i}`}
          row={row}
          index={i}
          revealProgress={revealProgress}
          screenHeight={screenHeight}
          highlightLead={highlightLead}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  hexHlTint: {
    color: Colors.gray[600]
  },
  hexSectionLabel: {
    color: Colors.gray[875],
    left: HEX_LEFT_PADDING,
    position: 'absolute',
    right: HEX_LEFT_PADDING
  },
  hexText: {
    fontFamily: Typography.sfProMono,
    fontSize: HEX_FONT_SIZE,
    left: HEX_LEFT_PADDING,
    lineHeight: HEX_LINE_HEIGHT,
    position: 'absolute',
    right: HEX_LEFT_PADDING,
    textAlign: 'center'
  },
  hexTextOverlayLine: {
    fontFamily: Typography.sfProMono,
    fontSize: HEX_FONT_SIZE,
    lineHeight: HEX_LINE_HEIGHT,
    textAlign: 'center'
  }
})

export default SSIntroAnimationHexStreamStep
