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
  useSVG,
  vec
} from '@shopify/react-native-skia'
import { useMemo } from 'react'

import { DUST_LIMIT } from '@/constants/btc'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { useSFProFonts } from '@/hooks/useSFProFonts'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { gray, mainGreen, mainRed, warning, white } from '@/styles/colors'
import {
  BLOCK_WIDTH,
  SANKEY_BAND_HEIGHT_MIN_PX,
  SANKEY_BLOCK_TX_STRIP_MAX_PX,
  type Node
} from '@/types/ui/sankey'
import {
  type SankeyRibbonPlan,
  totalThroughputToBandHeight
} from '@/utils/sankeyFlowWidths'
import { getUnspentOutputSatsColor } from '@/utils/sankeyOutputLabel'
import { CHART_REMAINING_BALANCE_LOCAL_ID } from '@/utils/stonewall'

type SSSankeyNodesProps = {
  nodes: Node[]
  ribbonPlan: SankeyRibbonPlan
  sankeyGenerator: { nodeWidth: () => number }
  selectedOutputNode?: string
  dimUnselected?: boolean
  /** When false, hides the “unspent” line on output cards (e.g. while composing a new tx). */
  showUnspentLabel?: boolean
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
  ribbonPlan,
  sankeyGenerator,
  selectedOutputNode,
  dimUnselected = false,
  showUnspentLabel = true
}: SSSankeyNodesProps) {
  const customFontManager = useSFProFonts()

  const maxDepth =
    nodes.length === 0 ? 0 : Math.max(...nodes.map((node) => node.depthH))

  const renderNode = (node: Node) => {
    const isSelectedOutput =
      selectedOutputNode !== undefined && node.localId === selectedOutputNode
    const shouldDim =
      dimUnselected &&
      selectedOutputNode !== undefined &&
      !isSelectedOutput &&
      node.depthH === 2

    // Calculate dynamic height for block nodes

    const getBlockNodeHeight = () => {
      if (node?.ioData?.txSize && node?.type === 'block') {
        return node?.ioData?.txSize * 0.1
      }
      return 0
    }

    const txSizeHeight = Math.min(
      Math.max(getBlockNodeHeight(), SANKEY_BAND_HEIGHT_MIN_PX),
      SANKEY_BLOCK_TX_STRIP_MAX_PX
    )

    const bandFromPlan = ribbonPlan.bandHeightByBlockId.get(node.id)
    const heightBasedOnFlow =
      bandFromPlan ?? totalThroughputToBandHeight(node.value ?? 0)

    const isTransactionChart = node.depthH === 1 && maxDepth === 2
    const blockNode = () => {
      if (node.type === 'block') {
        const isCurrentTxBlockNode = node.depthH === maxDepth - 1

        // Safely handle NaN values from sankey generator
        const safeX0 = Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)
        const safeY0 = Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)

        const x = safeX0 + (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
        const y = safeY0

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
              opacity={isTransactionChart ? 0.6 : 0.7}
              color={
                isTransactionChart
                  ? gray[500]
                  : isCurrentTxBlockNode
                    ? gray[100]
                    : gray[500]
              }
            />
          </Group>
        )
      }
      return null
    }

    return (
      <Group key={node.id} opacity={shouldDim ? 0.3 : 1}>
        {blockNode()}
        <NodeText
          isBlock={node.depthH % 2 !== 0}
          width={sankeyGenerator.nodeWidth()}
          x={Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)}
          y={(Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)) - 1.6}
          ioData={node.ioData}
          customFontManager={customFontManager}
          localId={node?.localId ?? ''}
          isTransactionChart={isTransactionChart}
          selectedOutputNode={selectedOutputNode}
          isFakeMix={node.ioData?.isFakeMix === true}
          isSelfSend={
            node.ioData?.isSelfSend &&
            !(node?.localId === CHART_REMAINING_BALANCE_LOCAL_ID) &&
            node.ioData?.isFakeMix !== true
          }
          showUnspentLabel={showUnspentLabel}
        />
      </Group>
    )
  }

  if (!customFontManager) {
    return null
  }

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
  selectedOutputNode,
  isFakeMix,
  isSelfSend,
  showUnspentLabel = true
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
  isFakeMix?: boolean
  isSelfSend?: boolean
  showUnspentLabel?: boolean
}) {
  const isMiningFee = localId.includes('minerFee')
  const isHigherMinerFee = ioData?.higherFee === true
  const isFeeValueWarning = isHigherMinerFee || ioData?.elevatedFeeRate === true
  const isChange = localId === CHART_REMAINING_BALANCE_LOCAL_ID
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
  const fakeMixIconSvg = useSVG(require('@/assets/green-fake-mix.svg'))
  const minerFeeIconSvg = useSVG(require('@/assets/red-miner.svg'))
  const blockNodeParagraph = useMemo(() => {
    if (!customFontManager) {
      return null
    }

    const baseTextStyle = {
      color: Skia.Color('white'),
      fontFamilies: ['SF Pro Text'],
      fontSize: BASE_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    }

    const createParagraphBuilder = () =>
      Skia.ParagraphBuilder.Make(
        {
          strutStyle: {
            forceStrutHeight: true,
            heightMultiplier: 1,
            leading: 0,
            strutEnabled: true
          },
          textAlign: isBlock ? TextAlign.Center : TextAlign.Left
        },
        customFontManager
      )

    const para = createParagraphBuilder()

    para
      .pushStyle({
        ...baseTextStyle,
        fontSize: XS_FONT_SIZE
      })
      .addText(`${ioData?.blockHeight}\n`)
      .pushStyle({
        ...baseTextStyle,
        color: Skia.Color(gray[500]),
        fontSize: XS_FONT_SIZE
      })
      .addText(`${ioData?.blockTime}\n`)
      .pushStyle({
        ...baseTextStyle,
        color: Skia.Color(gray[500]),
        fontSize: XS_FONT_SIZE
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
    if (!customFontManager) {
      return null
    }

    const baseTextStyle = {
      color: Skia.Color('white'),
      fontFamilies: ['SF Pro Text'],
      fontSize: BASE_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    }

    const createParagraphBuilder = () =>
      Skia.ParagraphBuilder.Make(
        {
          ellipsis: '…',
          maxLines: isSelfSend || isFakeMix ? 6 : 5,
          strutStyle: {
            forceStrutHeight: true,
            heightMultiplier: 1,
            leading: 0,
            strutEnabled: true
          },
          textAlign: isBlock ? TextAlign.Center : TextAlign.Left
        },
        customFontManager
      )

    const buildBlockParagraph = () => {
      const para = createParagraphBuilder()

      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: XS_FONT_SIZE
        })
        .addText(`${Math.ceil(ioData.vSize ?? 0)} vB`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color('rgba(255,255,255,0.6)'),
          fontSize: XS_FONT_SIZE
        })
        .addText(`\n${ioData?.txSize} B`)
        .pop()

      return para.build()
    }

    const buildMiningFeeParagraph = () => {
      const feeRateColor = isFeeValueWarning ? warning : 'white'
      const satsValueColor = isFeeValueWarning ? warning : 'white'
      const satVbLabelColor = isFeeValueWarning ? warning : Colors.gray[200]

      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(feeRateColor),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData?.feeRate}`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(satVbLabelColor),
          fontSize: XS_FONT_SIZE
        })
        .addText(` ${t('bitcoin.sats').toLowerCase()}/vB \n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(satsValueColor),
          fontSize: BASE_FONT_SIZE
        })

        .addText(`${ioData?.value?.toLocaleString()} `)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`sats\n`)
        .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(mainRed),
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          }
        })
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(` ${ioData?.text ?? ''}`)
        .pop()

      if (isHigherMinerFee && ioData?.feePercentage) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(warning),
            fontSize: XS_FONT_SIZE,
            fontStyle: {
              weight: 800
            }
          })
          .addText(` ${ioData.feePercentage}%`)
          .pop()
      }

      return para.build()
    }

    const buildUnspentParagraph = () => {
      const isGreenOutput = Boolean(isChange || isSelfSend || isFakeMix)
      const satsValueColor = getUnspentOutputSatsColor({
        isChange,
        isGreenOutput,
        isMiningFee,
        maxAllowedSats: ioData?.maxAllowedSats,
        value: ioData?.value
      })

      const para = createParagraphBuilder()
      if (showUnspentLabel) {
        para
          .pushStyle({
            ...baseTextStyle,
            fontSize: XS_FONT_SIZE
          })
          .addText(ioData?.text ?? '')
      }
      para
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(satsValueColor),
          fontSize: BASE_FONT_SIZE
        })
        .addText(
          showUnspentLabel
            ? `\n${ioData?.value?.toLocaleString()} `
            : `${ioData?.value?.toLocaleString()} `
        )
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`sats\n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
        .addText(ioData?.address ? `${t('common.to')} ` : '')
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color('white'),
          fontSize: XS_FONT_SIZE
        })
        .addText(ioData?.address ? `${ioData?.address}\n` : '')
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(isGreenOutput ? mainGreen : mainRed),
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          }
        })
        // Single placeholder for icon (change, self-send, or label)
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(
          isChange
            ? ` ${t('transaction.build.change')}`
            : isFakeMix
              ? ` ${t('transaction.build.fakeMix')}`
              : isSelfSend
                ? ` ${t('transaction.build.selfSend')}`
                : ` ${ioData.label ?? ''}`
        )
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          }
        })
        .addText(
          (isSelfSend || isFakeMix) && ioData?.label ? ` ${ioData.label}` : ''
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
          color: Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
        .addText(`${ioData?.text} `)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color('white'),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData?.address ?? ''}\n`) // Add nullish coalescing
        .pushStyle({
          ...baseTextStyle,
          color: hasLabel ? Skia.Color('white') : Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE
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
    ioData?.maxAllowedSats,
    ioData.fiatValue,
    ioData.fiatCurrency,
    ioData?.text,
    ioData?.feePercentage,
    ioData?.address,
    ioData.label,
    isHigherMinerFee,
    isFeeValueWarning,
    isChange,
    isFakeMix,
    isSelfSend,
    showUnspentLabel
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

  const dustBorderPaint = useMemo(() => {
    const paint = Skia.Paint()
    paint.setColor(Skia.Color(warning))
    paint.setStyle(PaintStyle.Stroke)
    paint.setStrokeWidth(1.5)
    return paint
  }, [])

  if (!customFontManager || !mainParagraph) {
    return null
  }

  const paragraphActualWidth = isBlock ? width * 0.6 : width - PADDING_LEFT
  const paragraphActualHeight = mainParagraph.getHeight()

  const isDustOutput =
    isUnspent &&
    !isChange &&
    !isMiningFee &&
    typeof ioData?.value === 'number' &&
    ioData.value > 0 &&
    ioData.value < DUST_LIMIT

  return (
    <Group>
      {isDustOutput && dustBorderPaint && (
        <RoundedRect
          x={groupBaseX - RECT_PADDING}
          y={paragraphY - RECT_PADDING}
          width={paragraphActualWidth + 2 * RECT_PADDING}
          height={paragraphActualHeight + 2 * RECT_PADDING}
          r={3}
          paint={dustBorderPaint}
        />
      )}
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
      {selectedOutputNode === localId ? (
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
        changeIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        placeholderRectsUnspentIcon[0] &&
        isChange && (
          <ImageSVG
            svg={changeIconSvg}
            x={groupBaseX + placeholderRectsUnspentIcon[0].rect.x}
            y={paragraphY + placeholderRectsUnspentIcon[0].rect.y}
            width={placeholderRectsUnspentIcon[0].rect.width}
            height={placeholderRectsUnspentIcon[0].rect.height}
          />
        )}
      {isUnspent &&
        fakeMixIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        placeholderRectsUnspentIcon[0] &&
        isFakeMix && (
          <ImageSVG
            svg={fakeMixIconSvg}
            x={groupBaseX + placeholderRectsUnspentIcon[0].rect.x}
            y={paragraphY + placeholderRectsUnspentIcon[0].rect.y}
            width={placeholderRectsUnspentIcon[0].rect.width}
            height={placeholderRectsUnspentIcon[0].rect.height}
          />
        )}
      {isUnspent &&
        labelIconSvg &&
        placeholderRectsUnspentIcon.length > 0 &&
        placeholderRectsUnspentIcon[0] &&
        !isChange &&
        !isSelfSend &&
        !isFakeMix &&
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
        placeholderRectsUnspentIcon[0] &&
        isSelfSend && (
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
        placeholderRectsMinerIcon.length > 0 &&
        placeholderRectsMinerIcon[0] && (
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
