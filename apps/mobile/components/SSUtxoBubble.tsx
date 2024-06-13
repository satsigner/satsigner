import {
  Circle,
  Group,
  Paint,
  Paragraph,
  Skia,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import {
  SharedValue,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated'

import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress } from '@/utils/format'
import React, { useMemo } from 'react'

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
    if (descriptionOpacity.value) return withTiming(Colors.gray[300])
    return withTiming(Colors.gray[400])
  }, [descriptionOpacity, selected])

  const fontSize = radius / 6
  const satsFontSize = fontSize / 1.5
  const descriptionFontSize = fontSize / 2.5

  const customFontMgr = useFonts({
    'SF Pro Text': [
      require(`../assets/fonts/SF-Pro-Text-Light.otf`),
      require(`../assets/fonts/SF-Pro-Text-Regular.otf`),
      require(`../assets/fonts/SF-Pro-Text-Medium.otf`)
    ]
  })

  // Utxo value
  const mainParagraph = useMemo(() => {
    if (!customFontMgr) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize: fontSize,
      fontStyle: {
        weight: selected ? 400 : 300
      }
    }
    const para = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle(textStyle)
      .addText(`${utxo.value.toLocaleString()}`)
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[600]),
        fontSize: satsFontSize
      })
      .addText(`${i18n.t('bitcoin.sats').toLowerCase()}`)
      .pop()
      .build()
    para.layout(200)
    return para
  }, [customFontMgr, selected, utxo.value, fontSize])

  const mainX = x - 200 / 2
  const mainTextheight = mainParagraph?.getHeight() || 0
  const mainY = y - (mainTextheight / 2 || 0)

  // Utxo date
  const dateText = new Date(utxo?.timestamp || '').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
  const dateY = radius > 10 ? mainY - radius / 8 : mainY - radius / 5
  const dateX = x - 100 / 2
  const dateParagraph = useMemo(() => {
    if (!customFontMgr) return null

    const textStyle = {
      color: Skia.Color(Colors.gray[700]),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle(textStyle)
      .addText(`${dateText}`)
      .pop()
      .build()
    para.layout(100)
    return para
  }, [customFontMgr, descriptionFontSize, dateText])

  // Utxo Memo
  const memoY = radius > 10 ? mainY + radius / 4 : mainY + radius / 7
  const memoX = x - 150 / 2
  const memoParagraph = useMemo(() => {
    if (!customFontMgr) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[500])
      })
      .addText(`${i18n.t('common.memo').toLowerCase()}`)
      .pushStyle({
        ...textStyle,
        fontStyle: {
          weight: 500
        }
      })
      .addText(`  ${formatAddress(utxo.label || '-')}`)
      .pop()
      .build()
    para.layout(150)
    return para
  }, [customFontMgr, utxo.label, descriptionFontSize])

  // Utxo from address
  const fromY = radius > 10 ? mainY + radius / 2.5 : mainY + radius / 3.5

  const fromParagraph = useMemo(() => {
    if (!customFontMgr) return null

    const textStyle = {
      color: Skia.Color('black'),
      fontFamilies: ['SF Pro Text'],
      fontSize: descriptionFontSize,
      fontStyle: {
        weight: 400
      }
    }
    const para = Skia.ParagraphBuilder.Make({
      maxLines: 1,
      textAlign: TextAlign.Center
    })
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[500])
      })
      .addText(`${i18n.t('common.from').toLowerCase()}`)
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
  }, [customFontMgr, utxo.addressTo, descriptionFontSize])

  if (!customFontMgr) return null

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
      {utxo.value && customFontMgr && (
        <Group>
          <Group layer={<Paint opacity={descriptionOpacity}></Paint>}>
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
          <Group layer={<Paint opacity={descriptionOpacity}></Paint>}>
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
