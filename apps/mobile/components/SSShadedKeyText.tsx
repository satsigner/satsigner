import { type StyleProp, StyleSheet, Text, type TextStyle } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'
import { chunkArray } from '@/utils/chunkArray'

const SHADE_CHUNK_SIZE = 4
const LINE_HEIGHT_RATIO = 1.45

type SSShadedKeyTextProps = {
  value: string
  size?: 'sm' | 'xl'
  style?: StyleProp<TextStyle>
  lineBreakEvery?: number
}

function splitIntoChunks(value: string, size: number) {
  return chunkArray([...value], size).map((chars) => chars.join(''))
}

function getChunkStyle(chunkIndex: number) {
  return chunkIndex % 2 === 0 ? styles.chunkEven : styles.chunkOdd
}

type ShadedChunksProps = {
  segment: string
  chunkOffset: number
}

function ShadedChunks({ segment, chunkOffset }: ShadedChunksProps) {
  return splitIntoChunks(segment, SHADE_CHUNK_SIZE).map((chunk, index) => {
    const chunkIndex = chunkOffset + index
    return (
      <Text key={`${chunkIndex}-${chunk}`} style={getChunkStyle(chunkIndex)}>
        {chunk}
      </Text>
    )
  })
}

function SSShadedKeyText({
  value,
  size = 'xl',
  style,
  lineBreakEvery
}: SSShadedKeyTextProps) {
  const trimmed = value.trim()
  const fontSize = Sizes.text.fontSize[size]
  const textStyle = [
    styles.base,
    { fontSize, lineHeight: Math.round(fontSize * LINE_HEIGHT_RATIO) },
    style
  ]

  if (!lineBreakEvery || lineBreakEvery <= 0) {
    return (
      <Text selectable style={textStyle}>
        <ShadedChunks segment={trimmed} chunkOffset={0} />
      </Text>
    )
  }

  const lines = splitIntoChunks(trimmed, lineBreakEvery)

  return (
    <Text selectable style={textStyle}>
      {lines.map((line, lineIndex) => (
        <Text key={`${lineIndex}-${line}`}>
          <ShadedChunks
            segment={line}
            chunkOffset={(lineIndex * lineBreakEvery) / SHADE_CHUNK_SIZE}
          />
          {lineIndex < lines.length - 1 ? '\n' : ''}
        </Text>
      ))}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Typography.geistMonoRegular,
    letterSpacing: 1,
    textAlign: 'center'
  },
  chunkEven: {
    color: Colors.white
  },
  chunkOdd: {
    color: Colors.gray[200]
  }
})

export default SSShadedKeyText
