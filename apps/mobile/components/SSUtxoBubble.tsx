import {
  Circle,
  Group,
  Text as SkiaText,
  useFont
} from '@shopify/react-native-skia'
import { Platform } from 'react-native'
import {
  SharedValue,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated'

import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress } from '@/utils/format'

type SSUtxoBubbleProps = {
  utxo: Utxo
  x: number
  y: number
  radius: number
  selected: boolean
  descriptionOpacity: Readonly<SharedValue<0 | 1>>
}

export default function SSUtxoBubble({
  utxo,
  x,
  y,
  radius,
  selected,
  descriptionOpacity
}: SSUtxoBubbleProps) {
  const backgroundColor = useDerivedValue(() => {
    if (selected) return withTiming(Colors.white)
    return withTiming(Colors.gray[400])
  })

  const fontSize = radius / 6

  const font = useFont(
    require(`../assets/fonts/SF-Pro-Text-Light.otf`),
    fontSize
  )

  const selectedFont = useFont(
    require(`../assets/fonts/SF-Pro-Text-Regular.otf`),
    fontSize
  )

  const descriptionLightFont = useFont(
    require(`../assets/fonts/SF-Pro-Text-Light.otf`),
    fontSize / 2.7
  )

  const text = `${utxo.value.toLocaleString()} ${i18n.t('bitcoin.sats').toLowerCase()}`
  const dateText = new Date(utxo?.timestamp || '').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const memo = `${i18n.t('common.memo').toLowerCase()} ${utxo.label || '-'}`

  const fromText = `${i18n.t('common.from').toLowerCase()} ${formatAddress(utxo.addressTo || '')}`

  const platformOffset = Platform.OS === 'ios' ? 1.5 : 0.5

  function getX() {
    const textDimensions = selected
      ? selectedFont?.measureText(utxo.value ? text : '')
      : font?.measureText(utxo.value ? text : '')

    return x - (textDimensions?.width || 0) / 2 + platformOffset
  }

  const dateDimensions = descriptionLightFont?.measureText(dateText)
  const memoDimensions = descriptionLightFont?.measureText(memo)
  const fromDimensions = descriptionLightFont?.measureText(fromText)

  const getXDate = () => {
    return x - (dateDimensions?.width || 0) / 2 + platformOffset
  }

  const getXMemo = () => {
    return x - (memoDimensions?.width || 0) / 2 + platformOffset
  }

  const getXFrom = () => {
    return x - (fromDimensions?.width || 0) / 2 + platformOffset
  }

  function getY() {
    // "/ 3" is just to make the text align properly in smaller Circle
    return y + (font?.getSize() || 0) / 3
  }

  const spacingY = (descriptionLightFont?.getSize() || 0) * 3

  const getYDate = () => {
    return getY() - spacingY
  }

  const getYMemo = () => {
    return getY() + spacingY / 1.4
  }

  const getYFrom = () => {
    return getY() + spacingY * 1.4
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
        <Group>
          <SkiaText
            text={dateText}
            x={getXDate()}
            y={getYDate()}
            font={descriptionLightFont}
            style="fill"
            color="#333333"
            strokeWidth={1}
            opacity={descriptionOpacity}
            antiAlias
          />
          <SkiaText
            text={text}
            x={getX()}
            y={getY()}
            font={selected ? selectedFont : font}
            style="fill"
            color={Colors.black}
            strokeWidth={1}
            antiAlias
          />

          <SkiaText
            text={memo}
            x={getXMemo()}
            y={getYMemo()}
            font={descriptionLightFont}
            style="fill"
            color="#333333"
            opacity={descriptionOpacity}
            strokeWidth={1}
            antiAlias
          />

          <SkiaText
            text={fromText}
            x={getXFrom()}
            y={getYFrom()}
            font={descriptionLightFont}
            style="fill"
            color="#333333"
            opacity={descriptionOpacity}
            strokeWidth={1}
            antiAlias
          />
        </Group>
      )}
    </Group>
  )
}
