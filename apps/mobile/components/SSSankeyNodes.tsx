import {
  Group,
  Paragraph,
  Rect,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign,
  useFonts
} from '@shopify/react-native-skia'
import { useMemo } from 'react'

import { t } from '@/locales'
import { Colors } from '@/styles'
import { gray } from '@/styles/colors'

import { type Node } from './SSMultipleSankeyDiagram'
import { LINK_BLOCK_MAX_WIDTH } from './SSSankeyLinks'

interface ISSankeyNodes {
  nodes: any[]
  sankeyGenerator: any
}

const BASE_FONT_SIZE = 13
const SM_FONT_SIZE = 10
const XS_FONT_SIZE = 8
const PADDING_LEFT = 8
const BLOCK_WIDTH = 50
const Y_OFFSET_BLOCK_NODE_TEXT = 10

export function SSSankeyNodes({ nodes, sankeyGenerator }: ISSankeyNodes) {
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  const renderNode = (node: Node, index: number) => {
    const dataNode = node as {
      type: string
      textInfo: string[]
      x0?: number
      y0?: number
    }

    // Calculate dynamic height for block nodes
    const getBlockHeight = () => {
      if (dataNode.textInfo[2]) {
        const sizeStr = dataNode.textInfo[2]
        const size = parseInt(sizeStr.split(' ')[0], 10)
        return size * 0.1
      }
      return 0
    }

    const blockNode = () => {
      if (dataNode.type === 'block') {
        return (
          <Group>
            <Rect
              x={(node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2}
              y={node.y0 ?? 0}
              width={BLOCK_WIDTH}
              height={getBlockHeight()}
              opacity={0.9}
              color="#787878"
            />
            <Rect
              x={(node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2}
              y={node.y0 ?? 0}
              width={BLOCK_WIDTH}
              height={LINK_BLOCK_MAX_WIDTH}
              color="#FFFFFF"
            />
          </Group>
        )
      }
      return null
    }

    return (
      <Group key={index}>
        <NodeText
          width={sankeyGenerator.nodeWidth()}
          x={node.x0 ?? 0}
          y={(node.y0 ?? 0) - 1.6}
          textInfo={dataNode.textInfo}
          customFontManager={customFontManager}
          blockHeight={getBlockHeight()}
        />
        {blockNode()}
      </Group>
    )
  }

  if (!customFontManager) return null

  return <>{nodes.map(renderNode)}</>
}

function NodeText({
  width,
  x,
  y,
  textInfo,
  customFontManager,
  blockHeight
}: {
  width: number
  x: number
  y: number
  textInfo: string[]
  customFontManager: SkTypefaceFontProvider | null
  blockHeight: number
}) {
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
          ? ` ${t('bitcoin.sats').toLowerCase()}\n`
          : isMiningFee
            ? ` ${t('bitcoin.sats').toLowerCase()}/vB \n`
            : '\n'
      )
      .pushStyle({
        ...textStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[300])
      })
      .addText(isAddress ? `${t('common.from')} ` : '')
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
      y={isBlock ? y + blockHeight - Y_OFFSET_BLOCK_NODE_TEXT : y}
      paragraph={mainParagraph}
    />
  )
}

export default SSSankeyNodes
