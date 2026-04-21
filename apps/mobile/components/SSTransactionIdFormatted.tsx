import { StyleSheet, Text, View } from 'react-native'

import SSText, { type SSTextProps } from '@/components/SSText'
import { Colors, Sizes, Typography } from '@/styles'

const TXID_HEX_64 = /^[0-9a-fA-F]{64}$/

/** Fallback tracking for non-hex / placeholder txid text */
const TXID_LETTER_SPACING = 0.5

/** Space between the two hex digits of one byte (two nibbles) */
const NIBBLE_PAIR_LETTER_SPACING = 0.35

/** Horizontal gap after each byte (after each pair of hex chars), except the last */
const BYTE_GAP = 5

const LINE_HEIGHT_MULTIPLIER = 1.38

function lineHeightForSize(fontSize: number) {
  return Math.round(fontSize * LINE_HEIGHT_MULTIPLIER)
}

function compactHexCandidate(value: string) {
  return value.replace(/\s+/g, '')
}

function chunkString(value: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += chunkSize) {
    chunks.push(value.slice(i, i + chunkSize))
  }
  return chunks
}

type SSTransactionIdFormattedProps = {
  size?: SSTextProps['size']
  value: string
}

function SSTransactionIdFormatted({
  size = 'lg',
  value
}: SSTransactionIdFormattedProps) {
  const compact = compactHexCandidate(value)
  const isTxidHex = TXID_HEX_64.test(compact)

  const fontSize = Sizes.text.fontSize[size]
  const lineHeight = lineHeightForSize(fontSize)

  if (!isTxidHex) {
    return (
      <SSText
        size={size}
        style={{
          letterSpacing: TXID_LETTER_SPACING,
          lineHeight
        }}
        type="mono"
      >
        {value}
      </SSText>
    )
  }

  const bytes = chunkString(compact, 2)

  return (
    <View style={styles.row}>
      {bytes.map((bytePair, byteIndex) => (
        <View
          key={`${byteIndex}-${bytePair}`}
          style={[
            styles.byteWrap,
            byteIndex < bytes.length - 1 ? styles.byteWrapGap : null
          ]}
        >
          <Text
            style={[
              styles.mono,
              {
                color:
                  Math.floor(byteIndex / 2) % 2 === 0
                    ? Colors.white
                    : Colors.gray[100],
                fontSize,
                letterSpacing: NIBBLE_PAIR_LETTER_SPACING,
                lineHeight
              }
            ]}
          >
            {bytePair}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  byteWrap: {
    flexShrink: 0
  },
  byteWrapGap: {
    marginRight: BYTE_GAP
  },
  mono: {
    fontFamily: Typography.sfProMono,
    includeFontPadding: false
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 2
  }
})

export default SSTransactionIdFormatted
