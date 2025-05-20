import {
  Group,
  ImageSVG,
  PaintStyle,
  Paragraph,
  PlaceholderAlignment,
  Rect,
  RoundedRect,
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
import { BLOCK_WIDTH, type Node } from '@/types/ui/sankey'
import { logAttenuation } from '@/utils/math'

interface ISSankeyNodes {
  nodes: any[]
  sankeyGenerator: any
  selectedOutputNode?: string
}

const BASE_FONT_SIZE = 13
const SM_FONT_SIZE = 10
const XS_FONT_SIZE = 8
const PADDING_LEFT = 8
// const Y_OFFSET_BLOCK_NODE_TEXT = 12
const ICON_SIZE = 8
const RECT_PADDING = 5
const NODE_MARGIN_LEFT = 1

function SSSankeyNodes({
  nodes,
  sankeyGenerator,
  selectedOutputNode
}: ISSankeyNodes) {
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

    const txSizeHeight = Math.max(getBlockNodeHeight(), 34)

    const heightBasedOnFlow = logAttenuation(node.value ?? 0)

    const isTransactionChart = node.depthH === 1 && maxDepth === 2
    const blockNode = () => {
      if (node.type === 'block') {
        const isCurrentTxBlockNode = node.depthH === maxDepth - 1

        const x =
          (node.x0 ?? 0) + (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
        const y = node.y0 ?? 0

        const gradientPaint = Skia.Paint()
        gradientPaint.setShader(
          Skia.Shader.MakeLinearGradient(
            vec(x, y + txSizeHeight / 2), // start point
            vec(x + BLOCK_WIDTH, y + txSizeHeight / 2), // end point
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
              height={heightBasedOnFlow}
              color={
                isTransactionChart
                  ? Skia.Color('#818181')
                  : isCurrentTxBlockNode
                    ? 'white'
                    : gray[400]
              }
              paint={isTransactionChart ? gradientPaint : undefined}
            />
            <Rect
              x={x + BLOCK_WIDTH / 6}
              y={y}
              width={BLOCK_WIDTH / 1.5}
              height={txSizeHeight}
              opacity={0.7}
              color={isCurrentTxBlockNode ? gray[200] : gray[500]}
            />
          </Group>
        )
      }
      return null
    }

    return (
      <Group key={index}>
        {blockNode()}
        <NodeText
          isBlock={node.depthH % 2 !== 0}
          width={sankeyGenerator.nodeWidth()}
          x={node.x0 ?? 0}
          y={(node.y0 ?? 0) - 1.6}
          ioData={node.ioData}
          customFontManager={customFontManager}
          localId={node?.localId ?? ''}
          isTransactionChart={isTransactionChart}
          selectedOutputNode={selectedOutputNode}
        />
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
  ioData,
  isTransactionChart,
  selectedOutputNode
}: {
  localId: string
  isBlock: boolean
  width: number
  x: number
  y: number
  customFontManager: SkTypefaceFontProvider | null
  ioData: TxNode['ioData']
  isTransactionChart: boolean
  selectedOutputNode?: string
}) {
  const isMiningFee = localId.includes('minerFee')
  const isChange = localId === 'remainingBalance'
  const isUnspent = ioData?.isUnspent

  const shadowPaint = useMemo(() => {
    const paint = Skia.Paint()
    paint.setColor(Skia.Color('#1E1E1E'))
    paint.setStyle(PaintStyle.Fill)
    paint.setImageFilter(
      Skia.ImageFilter.MakeDropShadow(
        0, // dx
        4, // dy
        2, // sigmaX (blurRad / 2 for blur = 4)
        2, // sigmaY (blurRad / 2 for blur = 4)
        Skia.Color('rgba(0,0,0,0.25)'), // #000000 with 25% opacity, changed to string format
        null // input filter (null means apply to source)
      )
    )
    return paint
  }, [])

  const labelIconSvg = useSVG(require('@/assets/red-label.svg'))
  const changeIconSvg = useSVG(require('@/assets/green-change.svg'))
  const minerFeeIconSvg = useSVG(require('@/assets/red-miner.svg'))
  const pastTxMinerFeeIconSvg = useSVG(require('@/assets/gray-miner.svg'))
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
          maxLines: 5,
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

  const isPastMinerFee = localId === 'past-minerFee'

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
          fontSize: SM_FONT_SIZE
        })
        .addText(`${ioData?.txSize} B`)
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE,
          color: Skia.Color('white')
        })
        .addText(`\n${Math.ceil(ioData.vSize ?? 0)} vB`)
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
          color: isPastMinerFee ? Skia.Color(gray[300]) : Skia.Color(mainRed)
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
      para = buildMiningFeeParagraph()
    } else if (isUnspent) {
      para = buildUnspentParagraph()
    } else {
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
    isPastMinerFee,
    isChange
  ])

  // Calculate position for the paragraph and potentially the icon
  const paragraphX = isBlock ? x + width * 0.2 : x + PADDING_LEFT
  const paragraphY = isBlock
    ? y + 4
    : // ? y + blockNodeHeight - Y_OFFSET_BLOCK_NODE_TEXT
      y

  // Apply additional margin if the node is unspent
  const groupBaseX = isUnspent ? paragraphX + NODE_MARGIN_LEFT : paragraphX

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

  const paragraphActualWidth = isBlock ? width * 0.6 : width - PADDING_LEFT
  const paragraphActualHeight = mainParagraph.getHeight()

  return (
    <Group>
      {isBlock && !isTransactionChart ? (
        <Paragraph
          paragraph={blockNodeParagraph}
          x={x + 6}
          // y={paragraphY - blockNodeMaxHeight}
          y={paragraphY - 62}
          // y={y}
          width={87}
        />
      ) : null}
      {isUnspent && selectedOutputNode === localId ? (
        <Group>
          <RoundedRect
            x={groupBaseX - RECT_PADDING}
            y={paragraphY - RECT_PADDING}
            width={paragraphActualWidth + 2 * RECT_PADDING}
            height={paragraphActualHeight + 2 * RECT_PADDING}
            r={3}
            paint={shadowPaint}
          />
          <Paragraph
            paragraph={mainParagraph}
            x={groupBaseX}
            y={paragraphY}
            width={paragraphActualWidth}
          />
        </Group>
      ) : (
        <Paragraph
          paragraph={mainParagraph}
          x={groupBaseX}
          y={paragraphY}
          width={paragraphActualWidth}
        />
      )}
      {isUnspent &&
        labelIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        ioData?.label && (
          <ImageSVG
            svg={labelIconSvg}
            x={groupBaseX + placeholderRectsUnspentIcon[0].rect.x}
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
            x={groupBaseX + placeholderRectsUnspentIcon[0].rect.x}
            y={paragraphY + placeholderRectsUnspentIcon[0].rect.y}
            width={placeholderRectsUnspentIcon[0].rect.width}
            height={placeholderRectsUnspentIcon[0].rect.height}
          />
        )}
      {isMiningFee &&
        minerFeeIconSvg &&
        pastTxMinerFeeIconSvg &&
        placeholderRectsMinerIcon.length > 0 && (
          <ImageSVG
            svg={isPastMinerFee ? pastTxMinerFeeIconSvg : minerFeeIconSvg}
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
