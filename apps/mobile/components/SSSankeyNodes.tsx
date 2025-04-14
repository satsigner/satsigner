import {
  Group,
  ImageSVG,
  Paragraph,
  PlaceholderAlignment,
  Rect,
  Skia,
  type SkTypefaceFontProvider,
  TextAlign,
  TextBaseline,
  useFonts,
  useSVG,
  vec
} from '@shopify/react-native-skia'
import { useMemo } from 'react'

import { t } from '@/locales'
import { Colors } from '@/styles'
import { gray, mainRed } from '@/styles/colors'

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
const ICON_SIZE = 10

function SSSankeyNodes({ nodes, sankeyGenerator }: ISSankeyNodes) {
  const customFontManager = useFonts({
    'SF Pro Text': [
      require('@/assets/fonts/SF-Pro-Text-Light.otf'),
      require('@/assets/fonts/SF-Pro-Text-Regular.otf'),
      require('@/assets/fonts/SF-Pro-Text-Medium.otf')
    ]
  })

  // Find the maximum depth in nodes
  const maxDepth = useMemo(() => {
    return Math.max(...nodes.map((node) => node.depthH))
  }, [nodes])

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
        const isCurrentTxBlockNode = node.depthH === maxDepth - 1
        const isTransactionChart = node.depthH === 1 && maxDepth === 2

        const x = (node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2
        const y = node.y0 ?? 0
        const height = getBlockHeight()

        const gradientPaint = Skia.Paint()
        gradientPaint.setShader(
          Skia.Shader.MakeLinearGradient(
            vec(x, y + height / 2), // start point
            vec(x + BLOCK_WIDTH, y + height / 2), // end point
            [Skia.Color(gray[200]), Skia.Color('#FFFFFF')], // colors
            [0, 1], // positions
            0, // Clamp mode
            Skia.Matrix()
          )
        )

        return (
          <Group>
            <Rect
              x={x}
              y={y}
              width={BLOCK_WIDTH}
              height={height}
              opacity={0.9}
              color={isCurrentTxBlockNode ? gray[100] : gray[500]}
            />
            <Rect
              x={x}
              y={y}
              width={BLOCK_WIDTH}
              height={LINK_BLOCK_MAX_WIDTH}
              color={
                isTransactionChart
                  ? Skia.Color('#818181')
                  : isCurrentTxBlockNode
                    ? 'white'
                    : gray[400]
              }
              paint={isTransactionChart ? gradientPaint : undefined}
            />
          </Group>
        )
      }
      return null
    }

    return (
      <Group key={index}>
        <NodeText
          isBlock={node.depthH % 2 !== 0}
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
  isBlock,
  width,
  x,
  y,
  textInfo,
  customFontManager,
  blockHeight
}: {
  isBlock: boolean
  width: number
  x: number
  y: number
  textInfo: string[]
  customFontManager: SkTypefaceFontProvider | null
  blockHeight: number
}) {
  const isMiningFee = textInfo[0].includes('/vB')
  const isAddress = textInfo[1].includes('...')
  const isUnspent = textInfo[0].includes('Unspent')
  const isNumeric = (text: string) => /^[0-9]+$/.test(text)
  const amount = textInfo[0].replace(/\s*sats\s*/g, '')

  const labelIconSvg = useSVG(require('@/assets/red-label.svg'))
  const changeIconSvg = useSVG(require('@/assets/green-change.svg'))
  const minerFeeIconSvg = useSVG(require('@/assets/red-miner-fee.svg'))

  const blockNodeParagraph = useMemo(() => {
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
      return Skia.ParagraphBuilder.Make(
        {
          maxLines: 3,
          textAlign: isBlock ? TextAlign.Center : TextAlign.Left,
          strutStyle: {
            strutEnabled: true,
            forceStrutHeight: true,
            heightMultiplier: 1,
            leading: 0
          }
        },
        customFontManager
      )
    }

    const para = createParagraphBuilder()
    // Split the datetime string into components
    const [dateTime, fromNow] = textInfo[0].split(' (')
    const formattedFromNow = fromNow ? `(${fromNow}` : '' // Add back the opening parenthesis
    para
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[500])
      })
      .addText(`${dateTime}\n`)
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[500])
      })
      .addText(`${formattedFromNow}\n`)
      .pushStyle({
        ...baseTextStyle,
        fontSize: SM_FONT_SIZE
      })
      .addText(`${textInfo[1]}`)
      .pop()

    const built = para.build()

    return built
  }, [customFontManager, isBlock, textInfo])

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
      return Skia.ParagraphBuilder.Make(
        {
          maxLines: 4,
          textAlign: isBlock ? TextAlign.Center : TextAlign.Left,
          strutStyle: {
            strutEnabled: true,
            forceStrutHeight: true,
            heightMultiplier: 1,
            leading: 0
          }
        },
        customFontManager
      ) // Pass font manager here
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
        .addText(`${Number(textInfo[1]).toLocaleString()} `)
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE,
          color: Skia.Color(Colors.gray[200])
        })
        .addText(`sats\n`)
        .pushStyle({
          // Style for the icon + text line
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          },
          color: Skia.Color(mainRed)
        })
        // Add placeholder for the miner svg icon
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(` ${textInfo[2].toLowerCase()}\n`) // Add space before text
        .pop() // Pop the red style

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
        .addText(textInfo[2] ? `${t('common.to').toLowerCase()} ` : '')
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
        // Add placeholder for the svg icon
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(textInfo[3] ?? t('transaction.build.change'))
        .pop()

      return para.build()
    }

    const buildNumericParagraph = () => {
      const hasLabel = textInfo?.[2]
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
          color: hasLabel ? Skia.Color('white') : Skia.Color(gray[300])
        })
        .addText(hasLabel ? `${textInfo[2]}\n` : `${t('common.noLabel')}\n`)
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

  // Calculate position for the paragraph and potentially the icon
  const paragraphX = isBlock ? x + width * 0.2 : x + PADDING_LEFT
  const paragraphY = isBlock ? y + blockHeight - Y_OFFSET_BLOCK_NODE_TEXT : y

  // Get placeholder rects if it's a mining fee node
  const placeholderRectsMinerIcon = useMemo(() => {
    if (isMiningFee && mainParagraph) {
      return mainParagraph.getRectsForPlaceholders()
    }
    return []
  }, [mainParagraph, isMiningFee])

  const placeholderRectsUnspentIcon = useMemo(() => {
    if (isUnspent && mainParagraph) {
      return mainParagraph.getRectsForPlaceholders()
    }
    return []
  }, [mainParagraph, isUnspent])

  if (!customFontManager || !mainParagraph) return null

  return (
    <Group>
      {isBlock ? (
        <Paragraph
          paragraph={blockNodeParagraph}
          x={x + 6}
          y={paragraphY - (blockHeight + LINK_BLOCK_MAX_WIDTH + 40)}
          width={87}
        />
      ) : null}
      <Paragraph
        paragraph={mainParagraph}
        x={paragraphX}
        y={paragraphY}
        width={isBlock ? width * 0.6 : width - PADDING_LEFT}
      />
      {isUnspent &&
        labelIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        textInfo[3] && (
          <ImageSVG
            svg={labelIconSvg}
            x={paragraphX + placeholderRectsUnspentIcon[0].rect.x}
            y={paragraphY + placeholderRectsUnspentIcon[0].rect.y}
            width={placeholderRectsUnspentIcon[0].rect.width}
            height={placeholderRectsUnspentIcon[0].rect.height}
          />
        )}
      {isUnspent &&
        changeIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        !textInfo[3] && (
          <ImageSVG
            svg={changeIconSvg}
            x={paragraphX + placeholderRectsUnspentIcon[0].rect.x}
            y={paragraphY + placeholderRectsUnspentIcon[0].rect.y}
            width={placeholderRectsUnspentIcon[0].rect.width}
            height={placeholderRectsUnspentIcon[0].rect.height}
          />
        )}
      {isMiningFee &&
        minerFeeIconSvg &&
        placeholderRectsMinerIcon.length > 0 && (
          <ImageSVG
            svg={minerFeeIconSvg}
            x={paragraphX + placeholderRectsMinerIcon[0].rect.x}
            y={paragraphY + placeholderRectsMinerIcon[0].rect.y}
            width={placeholderRectsMinerIcon[0].rect.width}
            height={placeholderRectsMinerIcon[0].rect.height}
          />
        )}
    </Group>
  )
}

export default SSSankeyNodes
