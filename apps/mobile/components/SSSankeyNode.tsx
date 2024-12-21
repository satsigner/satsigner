import {
  Paragraph,
  Skia,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import { useMemo } from 'react'

import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { gray } from '@/styles/colors'

interface ISSankeyNode {
  width: number
  x: number
  y: number
  textInfo: string[]
}

const BASE_FONT_SIZE = 13
const SM_FONT_SIZE = 10
const XS_FONT_SIZE = 8
const PADDING_LEFT = 8

export const SSSankeyNode = ({ textInfo, width, x, y }: ISSankeyNode) => {
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const isBlock = textInfo[0] === '' && textInfo[1] === ''

  const mainParagraph = useMemo(() => {
    if (!customFontManager) return null

    const isMiningFee = textInfo[0].includes('/vB')
    const isAddress = textInfo[1].includes('...')
    const isUnspent = textInfo[0].includes('Unspent')

    const isUnspentOrMiningFee = isUnspent || isMiningFee

    const textStyle = {
      color: Skia.Color('white'),
      fontFamilies: ['SF Pro Text'],
      fontSize: BASE_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    }
    const isNumeric = (text: string) => {
      return /^[0-9]+$/.test(text)
    }

    const amount = textInfo[0].replace(/\s*sats\s*/g, '')
    const para = Skia.ParagraphBuilder.Make({
      maxLines: 4,
      textAlign: isBlock ? TextAlign.Center : TextAlign.Left,
      strutStyle: {
        strutEnabled: true,
        forceStrutHeight: true,
        heightMultiplier: 1,
        leading: 0
      }
    })
      .pushStyle({
        ...textStyle,
        fontSize: isUnspentOrMiningFee ? XS_FONT_SIZE : BASE_FONT_SIZE
      })
      .addText(
        isNumeric(textInfo[0])
          ? `${Number(amount).toLocaleString()}`
          : isMiningFee
            ? textInfo[0].replace('sats/vB', '')
            : textInfo[0]
      )
      .pushStyle({
        ...textStyle,
        color: Skia.Color(Colors.gray[200]),
        fontSize: isMiningFee ? XS_FONT_SIZE : SM_FONT_SIZE
      })
      .addText(
        isNumeric(textInfo[0])
          ? ` ${i18n.t('bitcoin.sats').toLowerCase()}\n`
          : isMiningFee
            ? ` ${i18n.t('bitcoin.sats').toLowerCase()}/vB \n`
            : '\n'
      )
      .pushStyle({
        ...textStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[300])
      })
      .addText(isAddress ? `from ` : '')
      .pushStyle({
        ...textStyle,
        fontSize: isUnspentOrMiningFee ? BASE_FONT_SIZE : XS_FONT_SIZE,
        color: Skia.Color('white')
      })
      .addText(
        isUnspentOrMiningFee
          ? `${Number(textInfo[1]).toLocaleString()} sats\n`
          : `${textInfo[1]}\n`
      )
      .pushStyle({
        ...textStyle,
        fontSize: isBlock ? BASE_FONT_SIZE : XS_FONT_SIZE,
        color: isBlock ? Skia.Color('white') : Skia.Color(gray[300])
      })
      .addText(
        isMiningFee || isBlock || isUnspent
          ? `${textInfo[2]}\n`
          : `"${textInfo[2]}"\n`
      )
      .pushStyle({
        ...textStyle,
        fontSize: XS_FONT_SIZE,
        color: isBlock ? Skia.Color('white') : Skia.Color(gray[300])
      })
      .addText(isBlock || isUnspent ? `${textInfo[3] ?? ''}` : ``)
      .pop()
      .build()

    para.layout(isBlock ? width * 0.6 : width - PADDING_LEFT)
    return para
  }, [customFontManager, isBlock, textInfo, width])

  if (!customFontManager || !mainParagraph) return null

  return (
    <Paragraph
      width={isBlock ? width * 0.6 : width}
      x={isBlock ? x + width * 0.2 : x + PADDING_LEFT}
      y={isBlock ? y + 110 : y}
      paragraph={mainParagraph}
    />
  )
}
