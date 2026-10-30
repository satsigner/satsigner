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
import { useEffect, useEffectEvent, useMemo, useRef } from 'react'

import { DUST_LIMIT } from '@/constants/btc'
import {
  BLOCK_WIDTH,
  SANKEY_BAND_HEIGHT_MIN_PX,
  SANKEY_BLOCK_TX_STRIP_MAX_PX,
  SANKEY_BLOCK_TX_STRIP_PX_PER_BYTE
} from '@/constants/sankey'
import { useGeistFonts } from '@/hooks/useGeistFonts'
import type { TxNode } from '@/hooks/useNodesAndLinks'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import { gray, mainGreen, mainRed, warning, white } from '@/styles/colors'
import type { Node, SankeyOutputRole } from '@/types/ui/sankey'
import { formatFeeRateSatPerVb, formatNumber } from '@/utils/format'
import {
  type SankeyRibbonPlan,
  totalThroughputToBandHeight
} from '@/utils/sankeyFlowWidths'
import {
  getInputOwnershipTag,
  getSankeyNodeParagraphKind,
  getSankeyOutputRole,
  getSpentOutputTag,
  getUnspentOutputTag,
  trimNodeLabel
} from '@/utils/sankeyNodeText'
import {
  getNodeParagraphBoxWidth,
  getNodeParagraphLayoutWidth,
  getNodeParagraphOffsetX
} from '@/utils/sankeyNodeTextLayout'
import { getUnspentOutputSatsColor } from '@/utils/sankeyOutputLabel'

type SSSankeyNodesProps = {
  nodes: Node[]
  ribbonPlan: SankeyRibbonPlan
  sankeyGenerator: { nodeWidth: () => number }
  selectedOutputNode?: string
  dimUnselected?: boolean
  /** When false, hides the “unspent” line on output cards (e.g. while composing a new tx). */
  showUnspentLabel?: boolean
  /** Fires once Skia fonts are loaded and label paragraphs can paint. */
  onLabelsReady?: (ready: boolean) => void
}

type NodeTextProps = {
  localId: string
  isBlock: boolean
  width: number
  x: number
  y: number
  customFontManager: SkTypefaceFontProvider | null
  ioData: TxNode['ioData']
  isTransactionChart: boolean
  selectedOutputNode?: string
  outputRole: SankeyOutputRole
  showUnspentLabel?: boolean
  labelIconSvg: ReturnType<typeof useSVG>
  changeIconSvg: ReturnType<typeof useSVG>
  fakeMixIconSvg: ReturnType<typeof useSVG>
  minerFeeIconSvg: ReturnType<typeof useSVG>
}

/** Frames after fonts load before labels are considered painted. */
const LABEL_PAINT_FRAMES = 6

const BASE_FONT_SIZE = 13
const SM_FONT_SIZE = 10
const XS_FONT_SIZE = 8
const ICON_SIZE = 8
const RECT_PADDING = 5
const RECT_RADIUS = 3
const NODE_MARGIN_LEFT = 1
const NODE_TEXT_OFFSET_Y = -1.6
const BLOCK_TEXT_OFFSET_Y = 4
const BLOCK_INFO_OFFSET_X = 6
const BLOCK_INFO_OFFSET_Y = -62
const BLOCK_INFO_WIDTH = 87
const MAX_LINES = 5
const MAX_LINES_WITH_ROLE_AND_LABEL = 6
const DIMMED_NODE_OPACITY = 0.3
const DUST_BORDER_WIDTH = 1.5
const TRANSACTION_CHART_BLOCK_COLOR = '#818181'
/** Keeps the sats amount and unit on one line in Skia paragraphs. */
const NBSP = '\u00A0'
/** NBSP belongs on the unit run — trailing NBSP on the amount run can drop the first "s". */
const SATS_UNIT = `${NBSP}sats`

type SankeyTextStyle = {
  color: ReturnType<typeof Skia.Color>
  fontFamilies: string[]
  fontSize: number
  fontStyle: { weight: number }
}

type SankeyParagraphBuilder = ReturnType<typeof Skia.ParagraphBuilder.Make>

/**
 * Keep "to"/"from" and the address/txid on one line with identical font metrics
 * so Skia baselines align (only color differs).
 */
function appendDirectionTarget(
  para: SankeyParagraphBuilder,
  baseTextStyle: SankeyTextStyle,
  direction: 'from' | 'to',
  target: string
) {
  const label =
    direction === 'from'
      ? t('common.from').toLowerCase()
      : t('common.to').toLowerCase()

  para
    .pushStyle({
      ...baseTextStyle,
      color: Skia.Color(gray[500]),
      fontSize: XS_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    })
    .addText(`${label}${NBSP}`)
    .pushStyle({
      ...baseTextStyle,
      color: Skia.Color(white),
      fontSize: XS_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    })
    .addText(target)
}

function SSSankeyNodes({
  nodes,
  ribbonPlan,
  sankeyGenerator,
  selectedOutputNode,
  dimUnselected = false,
  showUnspentLabel = true,
  onLabelsReady
}: SSSankeyNodesProps) {
  const customFontManager = useGeistFonts()
  const labelIconSvg = useSVG(require('@/assets/red-label.svg'))
  const changeIconSvg = useSVG(require('@/assets/green-change.svg'))
  const fakeMixIconSvg = useSVG(require('@/assets/green-fake-mix.svg'))
  const minerFeeIconSvg = useSVG(require('@/assets/red-miner.svg'))

  const notifyLabelsReady = useEffectEvent(() => {
    onLabelsReady?.(true)
  })
  const labelsNotifiedRef = useRef(false)

  useEffect(() => {
    if (labelsNotifiedRef.current || !customFontManager) {
      return
    }

    let frame = 0
    let cancelled = false
    function waitForPaint(remaining: number) {
      if (cancelled) {
        return
      }
      if (remaining <= 0) {
        labelsNotifiedRef.current = true
        notifyLabelsReady()
        return
      }
      frame = requestAnimationFrame(() => waitForPaint(remaining - 1))
    }
    // Wait until NodeText paragraphs have mounted and Skia has painted them.
    waitForPaint(LABEL_PAINT_FRAMES)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [customFontManager])

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

    const getBlockNodeHeight = () => {
      if (node?.ioData?.txSize && node?.type === 'block') {
        return node?.ioData?.txSize * SANKEY_BLOCK_TX_STRIP_PX_PER_BYTE
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
                  ? Skia.Color(TRANSACTION_CHART_BLOCK_COLOR)
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
      <Group key={node.id} opacity={shouldDim ? DIMMED_NODE_OPACITY : 1}>
        {blockNode()}
        {customFontManager ? (
          <NodeText
            isBlock={node.depthH % 2 !== 0}
            width={sankeyGenerator.nodeWidth()}
            x={Number.isNaN(node.x0) ? 0 : (node.x0 ?? 0)}
            y={
              (Number.isNaN(node.y0) ? 0 : (node.y0 ?? 0)) + NODE_TEXT_OFFSET_Y
            }
            ioData={node.ioData}
            customFontManager={customFontManager}
            localId={node?.localId ?? ''}
            isTransactionChart={isTransactionChart}
            selectedOutputNode={selectedOutputNode}
            outputRole={getSankeyOutputRole(node.ioData, node.localId)}
            showUnspentLabel={showUnspentLabel}
            labelIconSvg={labelIconSvg}
            changeIconSvg={changeIconSvg}
            fakeMixIconSvg={fakeMixIconSvg}
            minerFeeIconSvg={minerFeeIconSvg}
          />
        ) : null}
      </Group>
    )
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
  outputRole,
  showUnspentLabel = true,
  labelIconSvg,
  changeIconSvg,
  fakeMixIconSvg,
  minerFeeIconSvg
}: NodeTextProps) {
  const { isChange, isFakeMix, isReceive, isSelfSend } = outputRole
  const isMiningFee = localId.includes('minerFee')
  const isHigherMinerFee = ioData?.higherFee === true
  const isFeeValueWarning = isHigherMinerFee || ioData?.elevatedFeeRate === true
  const isUnspent = ioData?.isUnspent === true
  const isNeutralOutput = ioData?.isNeutralOutput === true
  const isInput = ioData?.isInput === true
  const isPrivacyOwnedOutput = isChange || isSelfSend || isReceive || isFakeMix
  const showsRoleAndLabel = isSelfSend || isReceive || isFakeMix
  const usePrivacyOutputLayout =
    !isNeutralOutput && (isUnspent || isPrivacyOwnedOutput)
  const paragraphKind = getSankeyNodeParagraphKind({
    isBlock,
    isInput,
    isMiningFee,
    isNeutralOutput,
    isPrivacyOwnedOutput,
    isUnspent
  })

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
  const blockNodeParagraph = useMemo(() => {
    if (!customFontManager) {
      return null
    }

    const baseTextStyle = {
      color: Skia.Color('white'),
      fontFamilies: [Typography.geistSkiaFamily],
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
    ioData.blockHeight,
    ioData.blockRelativeTime,
    ioData.blockTime,
    ioData.txId,
    isBlock
  ])

  const paragraphLayoutWidth = getNodeParagraphLayoutWidth(width, isBlock)

  const mainParagraph = useMemo(() => {
    if (!customFontManager) {
      return null
    }

    const baseTextStyle = {
      color: Skia.Color('white'),
      fontFamilies: [Typography.geistSkiaFamily],
      fontSize: BASE_FONT_SIZE,
      fontStyle: {
        weight: 500
      }
    }

    const createParagraphBuilder = () =>
      Skia.ParagraphBuilder.Make(
        {
          ellipsis: '…',
          maxLines: showsRoleAndLabel
            ? MAX_LINES_WITH_ROLE_AND_LABEL
            : MAX_LINES,
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
        .addText(`${formatFeeRateSatPerVb(ioData?.feeRate ?? 0)}`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(satVbLabelColor),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${NBSP}${t('bitcoin.sats').toLowerCase()}/vB \n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(satsValueColor),
          fontSize: BASE_FONT_SIZE
        })

        .addText(formatNumber(ioData?.value ?? 0))
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${SATS_UNIT}\n`)
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
      const satsValueColor = getUnspentOutputSatsColor({
        isChange,
        isGreenOutput: isPrivacyOwnedOutput,
        isMiningFee,
        maxAllowedSats: ioData?.maxAllowedSats,
        value: ioData?.value
      })

      const para = createParagraphBuilder()
      if (showUnspentLabel) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(isUnspent ? white : gray[500]),
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
            ? `\n${formatNumber(ioData?.value ?? 0)}`
            : formatNumber(ioData?.value ?? 0)
        )
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${SATS_UNIT}\n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
      if (ioData?.address) {
        appendDirectionTarget(para, baseTextStyle, 'to', ioData.address)
        para.addText('\n')
      }
      para
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(isPrivacyOwnedOutput ? mainGreen : mainRed),
          fontSize: XS_FONT_SIZE,
          fontStyle: {
            weight: 800
          }
        })
        // Single placeholder for icon (change, self-send, receive, or label)
        .addPlaceholder(
          ICON_SIZE,
          ICON_SIZE,
          PlaceholderAlignment.Middle,
          TextBaseline.Alphabetic,
          0
        )
        .addText(
          ` ${getUnspentOutputTag(
            { isChange, isFakeMix, isReceive, isSelfSend },
            ioData.label
          )}`
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
          showsRoleAndLabel && ioData?.label
            ? ` ${trimNodeLabel(ioData.label)}`
            : ''
        )
        .pop()

      return para.build()
    }

    const buildNeutralOutputParagraph = () => {
      const hasFiat = Boolean(ioData?.fiatValue && ioData?.fiatCurrency)
      const hasAddress = Boolean(ioData?.address)
      const specialTag = ioData?.specialTag?.trim()
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(formatNumber(ioData?.value ?? 0))
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${SATS_UNIT}\n`)
      if (hasFiat) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(gray[300]),
            fontSize: XS_FONT_SIZE
          })
          .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
      }
      if (specialTag) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(Colors.gray[200]),
            fontSize: XS_FONT_SIZE,
            fontStyle: {
              weight: 800
            }
          })
          .addText(specialTag)
      } else if (hasAddress) {
        appendDirectionTarget(para, baseTextStyle, 'to', ioData.address ?? '')
      }
      return para.build()
    }

    const buildInputParagraph = () => {
      const hasFiat = Boolean(ioData?.fiatValue && ioData?.fiatCurrency)
      const hasOutpoint =
        Boolean(ioData?.address) && typeof ioData?.vout === 'number'
      const trimmedLabel = trimNodeLabel(ioData?.label)
      const ownershipTag = getInputOwnershipTag(ioData?.isOwnInput)
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(formatNumber(ioData?.value ?? 0))
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${SATS_UNIT}\n`)
      if (hasFiat) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(gray[300]),
            fontSize: XS_FONT_SIZE
          })
          .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
      }
      if (hasOutpoint) {
        appendDirectionTarget(
          para,
          baseTextStyle,
          'from',
          `${ioData.address}:${ioData.vout}`
        )
      }
      if (ownershipTag) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(ownershipTag.color),
            fontSize: XS_FONT_SIZE,
            fontStyle: {
              weight: 800
            }
          })
          .addText(`\n${ownershipTag.text}`)
      }
      if (trimmedLabel) {
        para
          .pushStyle({
            ...baseTextStyle,
            color: Skia.Color(gray[300]),
            fontSize: XS_FONT_SIZE,
            fontStyle: {
              weight: 800
            }
          })
          .addText(`\n${trimmedLabel}`)
      }
      para.pop()

      return para.build()
    }

    const buildSpentParagraph = () => {
      const para = createParagraphBuilder()
      para
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[500]),
          fontSize: XS_FONT_SIZE
        })
        .addText(ioData?.text ?? '')
        .pushStyle({
          ...baseTextStyle,
          fontSize: BASE_FONT_SIZE
        })
        .addText(`\n${formatNumber(ioData?.value ?? 0)}`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(Colors.gray[200]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${SATS_UNIT}\n`)
        .pushStyle({
          ...baseTextStyle,
          color: Skia.Color(gray[300]),
          fontSize: XS_FONT_SIZE
        })
        .addText(`${ioData.fiatValue} ${ioData.fiatCurrency}\n`)
      if (ioData?.address) {
        appendDirectionTarget(para, baseTextStyle, 'to', ioData.address)
        para.addText('\n')
      }
      para
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
        .addText(` ${getSpentOutputTag(ioData?.specialTag, ioData?.label)}`)
        .pop()

      return para.build()
    }

    const buildParagraphByKind = {
      block: buildBlockParagraph,
      input: buildInputParagraph,
      miningFee: buildMiningFeeParagraph,
      neutralOutput: buildNeutralOutputParagraph,
      spentOutput: buildSpentParagraph,
      unspentOutput: buildUnspentParagraph
    }
    const para = buildParagraphByKind[paragraphKind]()
    para.layout(paragraphLayoutWidth)
    return para
  }, [
    customFontManager,
    paragraphKind,
    showsRoleAndLabel,
    isBlock,
    isMiningFee,
    isUnspent,
    paragraphLayoutWidth,
    ioData.txSize,
    ioData.vSize,
    ioData.feeRate,
    ioData.value,
    ioData.maxAllowedSats,
    ioData.fiatValue,
    ioData.fiatCurrency,
    ioData.text,
    ioData.feePercentage,
    ioData.address,
    ioData.label,
    ioData.specialTag,
    ioData.vout,
    ioData.isOwnInput,
    isHigherMinerFee,
    isFeeValueWarning,
    isChange,
    isFakeMix,
    isSelfSend,
    isReceive,
    isPrivacyOwnedOutput,
    showUnspentLabel
  ])

  const paragraphX = x + getNodeParagraphOffsetX(width, isBlock)
  const paragraphY = isBlock ? y + BLOCK_TEXT_OFFSET_Y : y

  const isSpentOutput = paragraphKind === 'spentOutput'
  const groupBaseX =
    usePrivacyOutputLayout || isSpentOutput
      ? paragraphX + NODE_MARGIN_LEFT
      : paragraphX

  const placeholderRectsMinerIcon =
    isMiningFee && mainParagraph ? mainParagraph.getRectsForPlaceholders() : []

  const placeholderRectsOutputIcon =
    (usePrivacyOutputLayout || isSpentOutput) && mainParagraph
      ? mainParagraph.getRectsForPlaceholders()
      : []

  const dustBorderPaint = useMemo(() => {
    const paint = Skia.Paint()
    paint.setColor(Skia.Color(warning))
    paint.setStyle(PaintStyle.Stroke)
    paint.setStrokeWidth(DUST_BORDER_WIDTH)
    return paint
  }, [])

  if (!customFontManager || !mainParagraph) {
    return null
  }

  const paragraphBoxWidth = getNodeParagraphBoxWidth(
    width,
    isBlock,
    mainParagraph.getLongestLine()
  )
  const paragraphActualHeight = mainParagraph.getHeight()

  const outputIconRect = placeholderRectsOutputIcon[0]?.rect
  const minerIconRect = placeholderRectsMinerIcon[0]?.rect
  const fallbackIconY = Math.max(0, paragraphActualHeight - ICON_SIZE - 2)
  const outputIconX = groupBaseX + (outputIconRect?.x ?? 0)
  const outputIconY = paragraphY + (outputIconRect?.y ?? fallbackIconY)
  const outputIconW = outputIconRect?.width ?? ICON_SIZE
  const outputIconH = outputIconRect?.height ?? ICON_SIZE
  const minerIconX = paragraphX + (minerIconRect?.x ?? 0)
  const minerIconY = paragraphY + (minerIconRect?.y ?? fallbackIconY)
  const minerIconW = minerIconRect?.width ?? ICON_SIZE
  const minerIconH = minerIconRect?.height ?? ICON_SIZE

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
          width={paragraphBoxWidth + 2 * RECT_PADDING}
          height={paragraphActualHeight + 2 * RECT_PADDING}
          r={RECT_RADIUS}
          paint={dustBorderPaint}
        />
      )}
      {isBlock && !isTransactionChart ? (
        <Paragraph
          paragraph={blockNodeParagraph}
          x={x + BLOCK_INFO_OFFSET_X}
          y={paragraphY + BLOCK_INFO_OFFSET_Y}
          width={BLOCK_INFO_WIDTH}
        />
      ) : null}
      {selectedOutputNode === localId ? (
        <Group>
          <RoundedRect
            x={groupBaseX - RECT_PADDING}
            y={paragraphY - RECT_PADDING}
            width={paragraphBoxWidth + 2 * RECT_PADDING}
            height={paragraphActualHeight + 2 * RECT_PADDING}
            r={RECT_RADIUS}
            paint={shadowPaint}
          />
          <Paragraph
            paragraph={mainParagraph}
            x={groupBaseX}
            y={paragraphY}
            width={paragraphLayoutWidth}
          />
        </Group>
      ) : (
        <Paragraph
          paragraph={mainParagraph}
          x={groupBaseX}
          y={paragraphY}
          width={paragraphLayoutWidth}
        />
      )}
      {usePrivacyOutputLayout && changeIconSvg && isChange ? (
        <ImageSVG
          svg={changeIconSvg}
          x={outputIconX}
          y={outputIconY}
          width={outputIconW}
          height={outputIconH}
        />
      ) : null}
      {usePrivacyOutputLayout && fakeMixIconSvg && isFakeMix ? (
        <ImageSVG
          svg={fakeMixIconSvg}
          x={outputIconX}
          y={outputIconY}
          width={outputIconW}
          height={outputIconH}
        />
      ) : null}
      {usePrivacyOutputLayout &&
      labelIconSvg &&
      !isChange &&
      !isSelfSend &&
      !isReceive &&
      !isFakeMix &&
      ioData?.label ? (
        <ImageSVG
          svg={labelIconSvg}
          x={outputIconX}
          y={outputIconY}
          width={outputIconW}
          height={outputIconH}
        />
      ) : null}
      {usePrivacyOutputLayout && changeIconSvg && (isSelfSend || isReceive) ? (
        <ImageSVG
          svg={changeIconSvg}
          x={outputIconX}
          y={outputIconY}
          width={outputIconW}
          height={outputIconH}
        />
      ) : null}
      {isSpentOutput && labelIconSvg ? (
        <ImageSVG
          svg={labelIconSvg}
          x={outputIconX}
          y={outputIconY}
          width={outputIconW}
          height={outputIconH}
        />
      ) : null}
      {isMiningFee && minerFeeIconSvg ? (
        <ImageSVG
          svg={minerFeeIconSvg}
          x={minerIconX}
          y={minerIconY}
          width={minerIconW}
          height={minerIconH}
        />
      ) : null}
    </Group>
  )
}

export default SSSankeyNodes
