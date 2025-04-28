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

import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { gray, mainGreen, mainRed, white } from '@/styles/colors'
import { logAttenuation } from '@/utils/math'

import type { Node } from './SSMultipleSankeyDiagram'
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
const ICON_SIZE = 8

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
    // Calculate dynamic height for block nodes
    const getBlockNodeHeight = () => {
      if (node?.ioData?.txSize && node?.type === 'block') {
        return node?.ioData?.txSize * 0.1
      }
      return 0
    }
    const isTransactionChart = node.depthH === 1 && maxDepth === 2
    const blockNode = () => {
      if (node.type === 'block') {
        const isCurrentTxBlockNode = node.depthH === maxDepth - 1

        const x = (node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - 50) / 2
        const y = node.y0 ?? 0
        const height = getBlockNodeHeight()

        const gradientPaint = Skia.Paint()
        gradientPaint.setShader(
          Skia.Shader.MakeLinearGradient(
            vec(x, y + height / 2), // start point
            vec(x + BLOCK_WIDTH, y + height / 2), // end point
            [Skia.Color(gray[200]), Skia.Color(white)], // colors
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
              color={isCurrentTxBlockNode ? gray[200] : gray[500]}
            />
            <Rect
              x={x}
              y={y}
              width={BLOCK_WIDTH}
              height={logAttenuation(node.value ?? 0)}
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
          ioData={node.ioData}
          customFontManager={customFontManager}
          blockNodeHeight={getBlockNodeHeight()}
          localId={node?.localId ?? ''}
          isTransactionChart={isTransactionChart}
        />
        {blockNode()}
      </Group>
    )
  }

  if (!customFontManager) return null

  return <>{nodes.map(renderNode)}</>
}

function NodeText({
  localId,
  isBlock,
  width,
  x,
  y,
  customFontManager,
  blockNodeHeight,
  ioData,
  isTransactionChart
}: {
  localId: string
  isBlock: boolean
  width: number
  x: number
  y: number
  customFontManager: SkTypefaceFontProvider | null
  blockNodeHeight: number
  ioData: TxNode['ioData']
  isTransactionChart: boolean
}) {
  const isMiningFee = localId === 'minerFee'
  const isChange = localId === 'remainingBalance'
  const isUnspent = ioData?.isUnspent

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
      )
    }

    const para = createParagraphBuilder()

    para
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE
      })
      .addText(`${ioData?.blockHeight}\n`)
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[500])
      })
      .addText(`${ioData?.blockTime}\n`)
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE,
        color: Skia.Color(gray[500])
      })
      .addText(`${ioData?.blockRelativeTime}\n`)
      .pushStyle({
        ...baseTextStyle,
        fontSize: SM_FONT_SIZE
      })
      .addText(ioData?.txId ? `${ioData?.txId}` : '')
      .pop()

    const built = para.build()

    return built
  }, [
    customFontManager,
    ioData?.blockHeight,
    ioData?.blockRelativeTime,
    ioData?.blockTime,
    ioData?.txId,
    isBlock
  ])

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
        .addText(`${ioData?.txSize} B`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`\n${Math.ceil(ioData.vSize ?? 0)} vB`) // Already has nullish coalescing
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
        .addText(`${ioData?.feeRate}`) // Add optional chaining and nullish coalescing
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
        .addText(`${ioData?.value.toLocaleString()} `)
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
        .addText(` ${ioData?.text ?? ''}\n`) // Add optional chaining and nullish coalescing
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
        .addText(ioData?.text ?? '') // Add nullish coalescing
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`\n${ioData?.value.toLocaleString()} `) // Add nullish coalescing
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
        .addText(ioData?.address ? `${t('common.to')} ` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(ioData?.address ? `${ioData?.address}\n` : '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          },
          color: Skia.Color(isChange ? mainGreen : gray[300])
        })
        // Add placeholder for the svg icon
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(
          isChange ? ` ${t('transaction.build.change')}` : ` ${ioData.label}`
        )
        .pop()

      return para.build()
    }

    const buildSpentParagraph = () => {
      const hasLabel = ioData?.label
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(`${(ioData?.value ?? 0).toLocaleString()}`) // Already has optional chaining and nullish coalescing
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
        .addText(`${ioData?.text} `)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`${ioData?.address ?? ''}\n`) // Add nullish coalescing
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: hasLabel ? Skia.Color('white') : Skia.Color(gray[300])
        })
        .addText(
          hasLabel ? `${ioData.label ?? ''}\n` : `${t('common.noLabel')}\n`
        ) // Add nullish coalescing
        .pop()

      return para.build()
    }

    let para
    if (isBlock) {
      para = buildBlockParagraph()
    } else if (isMiningFee) {
      // console.log('mining', ioData.value)
      para = buildMiningFeeParagraph()
    } else if (isUnspent) {
      // console.log('unsepnt', ioData.value)
      para = buildUnspentParagraph()
    } else {
      // console.log('sepnt', ioData.value)
      para = buildSpentParagraph()
    }

    para.layout(isBlock ? width * 0.6 : width - PADDING_LEFT)
    return para
  }, [
    customFontManager,
    isBlock,
    isMiningFee,
    isUnspent,
    width,
    ioData?.txSize,
    ioData.vSize,
    ioData?.feeRate,
    ioData?.value,
    ioData?.text,
    ioData?.address,
    ioData.label,
    isChange
  ])

  // Calculate position for the paragraph and potentially the icon
  const paragraphX = isBlock ? x + width * 0.2 : x + PADDING_LEFT
  const paragraphY = isBlock
    ? y + blockNodeHeight - Y_OFFSET_BLOCK_NODE_TEXT
    : y

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
      {isBlock && !isTransactionChart ? (
        <Paragraph
          paragraph={blockNodeParagraph}
          x={x + 6}
          y={paragraphY - (blockNodeHeight + LINK_BLOCK_MAX_WIDTH + 56)}
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
        ioData?.label && (
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
        !ioData?.label && (
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
