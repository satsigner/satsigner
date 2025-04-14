import {
  Circle,
  Group,
  Paint,
  Paragraph,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign
} from '@shopify/react-native-skia'
import { memo, useEffect, useMemo } from 'react'
import {
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming
} from 'react-native-reanimated'

import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress } from '@/utils/format'
import { parseLabel } from '@/utils/parse'

type SSBubbleProps = {
  utxo: Utxo
  x: number
  y: number
  radius: number
  selected: boolean
  isZoomedIn: Readonly<SharedValue<boolean>>
  customFontManager: SkTypefaceFontProvider | null
  scale: Readonly<SharedValue<number>>
  animationDelay?: number
}

function SSBubble({
  utxo,
  x,
  y,
  radius,
  selected,
  isZoomedIn,
  customFontManager,
  scale,
  animationDelay = 0
}: SSBubbleProps) {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(
      animationDelay,
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: 250 })
      )
    )
  }, [animationDelay, opacity])

  const backgroundColor = useDerivedValue(() => {
    if (selected)
      return withTiming(Colors.white, {
        duration: 0
      })
    if (isZoomedIn?.value)
      return withTiming(Colors.gray[300], {
        duration: 0
      })
    return withTiming(Colors.gray[400], {
      duration: 0
    })
  }, [isZoomedIn, selected])

  const descriptionOpacity = useDerivedValue(() => {
    const zoomedRadius = scale.value * radius
    return withTiming(scale.value <= 1 || zoomedRadius <= 100 ? 0 : 1)
  }, [scale, radius])

  const fontSize = radius / 6
  const satsFontSize = fontSize / 1.5
  const descriptionFontSize = fontSize / 2.5

  const label = parseLabel(utxo.label || '').label

  // Utxo value
  const mainParagraph = useMemo(() => {
    if (!customFontManager) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize,
      fontStyle: {
        weight: selected ? 400 : 300
      }
    }
    const para = Skia.ParagraphBuilder.Make(
      {
        maxLines: 1,
        textAlign: TextAlign.Center
      },
      customFontManager
    )
      .pushStyle(textStyle)
      .addText(`${utxo.value.toLocaleString()}`)
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[600]),
        fontSize: satsFontSize
      })
      .addText(` ${t('bitcoin.sats').toLowerCase()}`)
      .pop()
      .build()
    para.layout(200)
    return para
  }, [customFontManager, selected, utxo.value, fontSize, satsFontSize])

  const mainX = x - 200 / 2
  const mainTextheight = mainParagraph?.getHeight() || 0
  const mainY = y - (mainTextheight / 2 || 0)

  // Utxo date
  const dateText = new Date(utxo?.timestamp || '').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const dateY = useMemo(() => {
    if (radius > 10) return mainY - radius / 8
    if (radius > 5) return mainY - radius / 12
    return mainY - radius / 4
  }, [radius, mainY])

  const dateX = x - 100 / 2
  const dateParagraph = useMemo(() => {
    if (!customFontManager) return null

    const textStyle = {
      color: Skia.Color(Colors.gray[700]),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make(
      {
        maxLines: 1,
        textAlign: TextAlign.Center
      },
      customFontManager
    )
      .pushStyle(textStyle)
      .addText(`${dateText}`)
      .pop()
      .build()
    para.layout(100)
    return para
  }, [customFontManager, descriptionFontSize, dateText])

  // Utxo Memo
  const memoY = useMemo(() => {
    // spacing based on radius because Skia is not consistent for now
    if (radius > 10) return mainY + radius / 4
    if (radius > 5) return mainY + radius / 3.2
    return mainY + radius / 7
  }, [radius, mainY])
  const memoX = x - 150 / 2
  const memoParagraph = useMemo(() => {
    if (!customFontManager) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make(
      {
        maxLines: 1,
        textAlign: TextAlign.Center
      },
      customFontManager
    )
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[500])
      })
      .addText(`${t('common.label').toLowerCase()}`)
      .pushStyle({
        ...textStyle,
        fontStyle: {
          weight: 500
        }
      })
      .addText(`  ${formatAddress(label || '-')}`)
      .pop()
      .build()
    para.layout(150)
    return para
  }, [customFontManager, label, descriptionFontSize])

  // Utxo from address
  const fromY = useMemo(() => {
    // spacing based on radius because Skia is not consistent for now
    if (radius > 10) return mainY + radius / 2.5
    if (radius > 5) return mainY + radius / 2.2
    return mainY + radius / 3.5
  }, [radius, mainY])

  const fromParagraph = useMemo(() => {
    if (!customFontManager) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make(
      {
        maxLines: 1,
        textAlign: TextAlign.Center
      },
      customFontManager
    )
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[500])
      })
      .addText(`${t('common.from').toLowerCase()}`)
      .pushStyle({
        ...textStyle,
        fontStyle: {
          weight: 500
        }
      })
      .addText(`  ${formatAddress(utxo.addressTo || '')}`)
      .pop()
      .build()
    para.layout(150)
    return para
  }, [customFontManager, utxo.addressTo, descriptionFontSize])

  if (!customFontManager) return null

  return (
    <Group layer={<Paint opacity={opacity} />}>
      <Circle
        cx={x}
        cy={y}
        r={radius}
        color={backgroundColor}
        style="fill"
        antiAlias
      />
      {utxo.value && customFontManager && (
        <Group>
          <Group layer={<Paint opacity={descriptionOpacity} />}>
            <Paragraph
              paragraph={dateParagraph}
              x={dateX}
              y={dateY}
              width={100}
            />
          </Group>
          <Paragraph
            paragraph={mainParagraph}
            x={mainX}
            y={mainY}
            width={200}
          />
          <Group layer={<Paint opacity={descriptionOpacity} />}>
            <Paragraph
              paragraph={memoParagraph}
              x={memoX}
              y={memoY}
              width={150}
            />
            <Paragraph
              paragraph={fromParagraph}
              x={memoX}
              y={fromY}
              width={150}
            />
          </Group>
        </Group>
      )}
    </Group>
  )
}

export default memo(SSBubble)
