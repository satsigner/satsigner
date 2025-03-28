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
const Y_OFFSET_BLOCK_NODE_TEXT = -10

function SSSankeyNodes({ nodes, sankeyGenerator }: ISSankeyNodes) {
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
  const isMiningFee = textInfo[0].includes('/vB')
  const isAddress = textInfo[1].includes('...')
  const isUnspent = textInfo[0].includes('Unspent')
  const isNumeric = (text: string) => /^[0-9]+$/.test(text)
  const amount = textInfo[0].replace(/\s*sats\s*/g, '')

  const mainParagraph = useMemo(() => {
    if (!customFontManager) return null

    const baseTextStyle = {
      color: Skia.Color('white'),
      fontFamilies: ['SF Pro Text'],
      fontSize: BASE_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    }

    const createParagraphBuilder = () => {
      return Skia.ParagraphBuilder.Make({
        maxLines: 4,
        textAlign: isBlock ? TextAlign.Center : TextAlign.Left,
        strutStyle: {
          strutEnabled: true,
          forceStrutHeight: true,
          heightMultiplier: 1,
          leading: 0
        }
      })
    }

    const buildBlockParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(textInfo[2])
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`\n${textInfo[3] ?? ''}`)
        .pop()

      return para.build()
    }

    const buildMiningFeeParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE
        })
        .addText(textInfo[0].replace('sats/vB', ''))
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(` ${t('bitcoin.sats').toLowerCase()}/vB \n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`${Number(textInfo[1]).toLocaleString()} sats\n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(`${textInfo[2]}\n`)
        .pop()

      return para.build()
    }

    const buildUnspentParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE
        })
        .addText(textInfo[0])
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`\n${Number(textInfo[1]).toLocaleString()} `)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[200])
        })
        .addText(`sats\n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(textInfo[2] ? `${t('common.to')} ` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(textInfo[2] ? `${textInfo[2]}\n` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(textInfo[3] ?? '')
        .pop()

      return para.build()
    }

    const buildNumericParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(`${Number(amount).toLocaleString()}`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: SM_FONT_SIZE
        })
        .addText(` ${t('bitcoin.sats').toLowerCase()}\n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(isAddress ? `${t('common.from')} ` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`${textInfo[1]}\n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(`"${textInfo[2]}"\n`)
        .pop()

      return para.build()
    }

    const buildDefaultParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(textInfo[0])
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: SM_FONT_SIZE
        })
        .addText('\n')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(isAddress ? `${t('common.from')} ` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`${textInfo[1]}\n`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color(gray[300])
        })
        .addText(`"${textInfo[2]}"\n`)
        .pop()

      return para.build()
    }

    let para
    if (isBlock) {
      para = buildBlockParagraph()
    } else if (isMiningFee) {
      para = buildMiningFeeParagraph()
    } else if (isUnspent) {
      para = buildUnspentParagraph()
    } else if (isNumeric(textInfo[0])) {
      para = buildNumericParagraph()
    } else {
      para = buildDefaultParagraph()
    }

    para.layout(isBlock ? width * 0.6 : width - PADDING_LEFT)
    return para
  }, [
    customFontManager,
    isBlock,
    isMiningFee,
    isUnspent,
    isAddress,
    textInfo,
    width,
    amount
  ])

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
