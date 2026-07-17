import { Group, Path, Skia, vec } from '@shopify/react-native-skia'

import type { TxNode } from '@/hooks/useNodesAndLinks'
import { gray, white } from '@/styles/colors'
import {
  SANKEY_LINK_CURVE_CONTROL_MAX_PX,
  SANKEY_OUTGOING_UNSPENT_RIBBON_COLOR,
  SANKEY_OUTGOING_UNSPENT_RIBBON_RED_PLATEAU_STOP
} from '@/types/ui/sankey'
import {
  type SankeyRibbonPlan,
  ribbonWidthForLink,
  stackedRibbonOffsetBeforeLink
} from '@/utils/sankeyFlowWidths'
import { CHART_REMAINING_BALANCE_LOCAL_ID } from '@/utils/stonewall'

interface Node {
  id: string
  depthH: number
  type: string
  x0?: number
  x1?: number
  y0?: number
  y1?: number
  depth?: number
  address?: string
  value?: number
  txId?: string
  nextTx?: string
  localId?: string
  ioData: TxNode['ioData']
}

interface Link {
  source: string
  target: string
  value: number
}

interface LinkPoints {
  sourceWidth: number
  targetWidth: number
  x1: number
  y1: number
  x2: number
  y2: number
}

interface SSSankeyLinksProps {
  links: Link[]
  nodes: Node[]
  ribbonPlan: SankeyRibbonPlan
  sankeyGenerator: { nodeWidth: () => number }
  BLOCK_WIDTH: number
  selectedOutputNode?: string
  dimUnselected?: boolean
}

function buildSolidPaint(hexColor: string, alpha: number) {
  const paint = Skia.Paint()
  paint.setColor(Skia.Color(hexColor))
  paint.setAlphaf(alpha)
  return paint
}

function buildLinearGradientPaint(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  colors: string[],
  positions: number[],
  alpha = 1
) {
  const paint = Skia.Paint()
  if (alpha < 1) {
    paint.setAlphaf(alpha)
  }
  paint.setShader(
    Skia.Shader.MakeLinearGradient(
      vec(startX, startY),
      vec(endX, endY),
      colors.map((c) => Skia.Color(c)),
      positions,
      0,
      Skia.Matrix()
    )
  )
  return paint
}

function findNodeById(nodes: Node[], id: string): Node | undefined {
  return nodes.find((n) => n.id === id)
}

function SSSankeyLinks({
  links,
  nodes,
  ribbonPlan,
  sankeyGenerator,
  BLOCK_WIDTH,
  selectedOutputNode,
  dimUnselected = false
}: SSSankeyLinksProps) {
  if (links.length === 0) {
    return null
  }

  return (
    <>
      {links.map((link, index) => {
        const sourceNode = findNodeById(nodes, link.source)
        const targetNode = findNodeById(nodes, link.target)
        if (!sourceNode || !targetNode) {
          return null
        }

        const ribbonW = ribbonWidthForLink(ribbonPlan, link.source, link.target)

        const isUnspent = targetNode.ioData?.isUnspent === true
        const isFakeMixOutput = targetNode.ioData?.isFakeMix === true
        const isChangeOutput =
          targetNode.ioData?.isChange === true ||
          targetNode.localId === CHART_REMAINING_BALANCE_LOCAL_ID
        const isSelfSendOutput =
          targetNode.ioData?.isSelfSend === true &&
          targetNode.ioData?.isFakeMix !== true &&
          !isChangeOutput
        // Owned unspent ribbons stay solid white; spent change uses the fadeout.
        const isOwnOrUnspentRibbon =
          isUnspent || isSelfSendOutput || isFakeMixOutput
        const isRemainingBalance =
          targetNode.localId === CHART_REMAINING_BALANCE_LOCAL_ID
        const isCurrentTxMinerFee = targetNode.localId === 'current-minerFee'
        const maxDepthH = Math.max(...nodes.map((n) => n.depthH))
        const isCurrentTx =
          targetNode.depthH === maxDepthH - 1 ||
          sourceNode.depthH === maxDepthH - 1

        const isFromTransactionChart = maxDepthH === 2
        const isCurrentInput = isFromTransactionChart && sourceNode.depthH === 0

        const isSelectedOutput =
          selectedOutputNode !== undefined &&
          targetNode.localId === selectedOutputNode
        const shouldDim =
          dimUnselected &&
          selectedOutputNode !== undefined &&
          !isSelectedOutput &&
          targetNode.depthH === 2

        // Sankey nodes: y0 = top, y1 = bottom. Ribbon quadrilateral uses y as *top* edge at each side.
        const y1 =
          sourceNode.type === 'block'
            ? (sourceNode.y0 ?? 0) +
              stackedRibbonOffsetBeforeLink(
                sourceNode,
                true,
                link,
                links,
                nodes,
                ribbonPlan
              )
            : (sourceNode.y0 ?? 0)

        const y2 =
          targetNode.type === 'block'
            ? (targetNode.y0 ?? 0) +
              stackedRibbonOffsetBeforeLink(
                targetNode,
                false,
                link,
                links,
                nodes,
                ribbonPlan
              )
            : (targetNode.y0 ?? 0)

        const points: LinkPoints = {
          sourceWidth: ribbonW,
          targetWidth: ribbonW,
          x1:
            sourceNode.type === 'block'
              ? (sourceNode.x1 ?? 0) -
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : (sourceNode.x1 ?? 0),
          x2:
            targetNode.type === 'block'
              ? (targetNode.x0 ?? 0) +
                (sankeyGenerator.nodeWidth() - BLOCK_WIDTH) / 2
              : (targetNode.x0 ?? 0),
          y1,
          y2
        }
        const path1 = generateCustomLink(points)

        if (targetNode.value === 0 && targetNode.depthH === maxDepthH) {
          return null
        }

        const midY = (points.y1 + points.y2) / 2
        const gradStartX = targetNode.type === 'block' ? points.x1 : points.x2
        const gradEndX = targetNode.type === 'block' ? points.x2 : points.x1

        return (
          <Group
            key={`${link.source}-${link.target}-${index}`}
            opacity={shouldDim ? 0.2 : 1}
          >
            <Path
              path={path1}
              style="fill"
              antiAlias={false}
              color={isCurrentTx || isOwnOrUnspentRibbon ? 'white' : gray[700]}
              opacity={isCurrentTx || isOwnOrUnspentRibbon ? 1 : 0.5}
            />
            {(isCurrentTx || isCurrentTxMinerFee) &&
            !isRemainingBalance &&
            !isOwnOrUnspentRibbon ? (
              <>
                <Path
                  path={path1}
                  style="fill"
                  paint={buildSolidPaint('#363636', 0.6)}
                />
                <Path
                  path={path1}
                  style="fill"
                  paint={buildLinearGradientPaint(
                    gradStartX,
                    midY,
                    gradEndX,
                    midY,
                    [gray[900], isCurrentInput ? gray[200] : white],
                    [0, isCurrentInput ? 1 : 0.7]
                  )}
                />
              </>
            ) : isOwnOrUnspentRibbon &&
              !isRemainingBalance &&
              !isSelfSendOutput &&
              !isFakeMixOutput &&
              !isChangeOutput ? (
              <Path
                path={path1}
                style="fill"
                paint={buildLinearGradientPaint(
                  gradStartX,
                  midY,
                  gradEndX,
                  midY,
                  [
                    SANKEY_OUTGOING_UNSPENT_RIBBON_COLOR,
                    SANKEY_OUTGOING_UNSPENT_RIBBON_COLOR,
                    white
                  ],
                  [0, SANKEY_OUTGOING_UNSPENT_RIBBON_RED_PLATEAU_STOP, 1]
                )}
              />
            ) : !isOwnOrUnspentRibbon && !isRemainingBalance ? (
              <>
                <Path
                  path={path1}
                  style="fill"
                  paint={buildSolidPaint('#363636', 0.2)}
                />
                <Path
                  path={path1}
                  style="fill"
                  paint={buildLinearGradientPaint(
                    gradStartX,
                    midY,
                    gradEndX,
                    midY,
                    ['#FFFFFF', '#2C2C2C'],
                    [0, 1],
                    0.2
                  )}
                />
              </>
            ) : null}
          </Group>
        )
      })}
    </>
  )
}

function generateCustomLink(points: LinkPoints) {
  const { x1, y1, x2, y2, sourceWidth, targetWidth } = points

  const A = [x1, y1]
  const B = [x1, y1 + sourceWidth]
  const C = [x2, y2]
  const D = [x2, y2 + targetWidth]

  const horizontalDistance = Math.abs(x2 - x1)

  const controlPointOffset = Math.min(
    horizontalDistance * 0.4,
    SANKEY_LINK_CURVE_CONTROL_MAX_PX
  )

  const [bX, bY] = B
  const [dX, dY] = D
  const [cX, cY] = C
  const [aX, aY] = A

  const bottomCurveCP1X = bX + controlPointOffset
  const bottomCurveCP1Y = bY
  const bottomCurveCP2X = dX - controlPointOffset
  const bottomCurveCP2Y = dY

  const topCurveCP1X = cX - controlPointOffset
  const topCurveCP1Y = cY
  const topCurveCP2X = aX + controlPointOffset
  const topCurveCP2Y = aY

  const moveToA = `M ${A[0]} ${A[1]}`
  const lineToB = `L ${B[0]} ${B[1]}`

  const curveToD = `C ${bottomCurveCP1X} ${bottomCurveCP1Y}, ${bottomCurveCP2X} ${bottomCurveCP2Y}, ${D[0]} ${D[1]}`

  const lineToC = `L ${C[0]} ${C[1]}`

  const curveToA = `C ${topCurveCP1X} ${topCurveCP1Y}, ${topCurveCP2X} ${topCurveCP2Y}, ${A[0]} ${A[1]}`

  return [moveToA, lineToB, curveToD, lineToC, curveToA, 'Z'].join(' ')
}

export default SSSankeyLinks
