import {
  Circle,
  Group,
  listFontFamilies,
  matchFont,
  Text as SkiaText
} from '@shopify/react-native-skia'
import { Platform } from 'react-native'
import { useDerivedValue, withTiming } from 'react-native-reanimated'

import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'

type SSUtxoBubbleProps = {
  utxo: Utxo
  x: number
  y: number
  radius: number
  selected: boolean
}

export default function SSUtxoBubble({
  utxo,
  x,
  y,
  radius,
  selected
}: SSUtxoBubbleProps) {
  const backgroundColor = useDerivedValue(() => {
    if (selected) return withTiming(Colors.white)
    return withTiming(Colors.gray[400])
  })

  const fontSize = radius / 6

  const fontFamilies = listFontFamilies() // TODO: Add SF Pro Text

  const font = matchFont({
    fontFamily: fontFamilies[0],
    fontSize
  })
  const selectedFont = matchFont({
    fontFamily: fontFamilies[0],
    fontSize,
    fontWeight: '500'
  })

  const text = `${utxo.value.toLocaleString()} ${i18n.t('bitcoin.sats').toLowerCase()}`

  function getX() {
    const textDimensions = selected
      ? selectedFont?.measureText(utxo.value ? text : '')
      : font?.measureText(utxo.value ? text : '')

    const platformOffset = Platform.OS === 'ios' ? 1.5 : 0.5

    return x - (textDimensions?.width || 0) / 2 + platformOffset
  }

  function getY() {
    // "/ 3" is just to make the text align properly in smaller Circle
    return y + (font?.getSize() || 0) / 3
  }

  if (!font) return null

  return (
    <Group>
      <Circle
        cx={x}
        cy={y}
        r={radius}
        color={backgroundColor}
        style="fill"
        antiAlias
      />
      {utxo.value && font && (
        <SkiaText
          text={text}
          x={getX()}
          y={getY()}
          font={selected ? selectedFont : font}
          style="fill"
          color="#000000"
          strokeWidth={1}
          antiAlias
        />
      )}
    </Group>
  )
}
