import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import {
  type ArkVtxoLineageStep,
  getArkVtxoLineageView
} from '@/utils/arkVtxoDetail'
import { formatMaskedNumber, formatTxId } from '@/utils/format'

const MAX_SIBLING_DOTS = 6
const DOT_SIZE = 10
const LEAF_DOT_SIZE = 14
const SIBLING_DOT_SIZE = 6
const RAIL_WIDTH = 16
const GAP_DOT_SIZE = 4
const GAP_HIT_SLOP = 12

type LineageNodeVariant = 'anchor' | 'step' | 'gap' | 'leaf'

type LineageNodeProps = {
  variant: LineageNodeVariant
  isLast?: boolean
  children: React.ReactNode
}

function LineageNode({ variant, isLast = false, children }: LineageNodeProps) {
  return (
    <SSHStack gap="md" style={styles.node}>
      <View style={styles.rail}>
        <View style={[styles.dot, dotStyles[variant]]} />
        {!isLast && <View style={styles.line} />}
      </View>
      <SSVStack gap="xxs" style={[styles.body, !isLast && styles.bodyGap]}>
        {children}
      </SSVStack>
    </SSHStack>
  )
}

type SiblingBranchProps = {
  count: number
  sats: number
  privacyMode: boolean
}

function SiblingBranch({ count, sats, privacyMode }: SiblingBranchProps) {
  if (count === 0) {
    return null
  }
  const dots = Array.from({ length: Math.min(count, MAX_SIBLING_DOTS) })
  return (
    <SSHStack gap="xs" style={styles.branch}>
      <View style={styles.branchLine} />
      <SSHStack gap="xxs">
        {dots.map((_, index) => (
          <View key={index} style={styles.siblingDot} />
        ))}
      </SSHStack>
      <SSText size="xxs" color="muted">
        {t('ark.vtxo.detail.lineage.siblings', {
          amount: formatMaskedNumber(sats, privacyMode),
          count
        })}
      </SSText>
    </SSHStack>
  )
}

type StepNodeProps = {
  step: ArkVtxoLineageStep
  index: number
  privacyMode: boolean
}

function StepNode({ step, index, privacyMode }: StepNodeProps) {
  const satsUnit = t('bitcoin.sats')
  return (
    <LineageNode variant="step">
      <SSHStack justifyBetween>
        <SSText size="xs" uppercase>
          {t('ark.vtxo.detail.lineage.step', { index: index + 1 })}
        </SSText>
        <SSText size="xxs" color="muted" uppercase>
          {t(`ark.vtxo.detail.lineage.transition.${step.transition}`)}
          {!step.signed && ` · ${t('ark.vtxo.detail.lineage.unsigned')}`}
        </SSText>
      </SSHStack>
      <SSText size="xs" style={styles.mono}>
        {formatTxId(step.txid)}
      </SSText>
      <SSText size="xs" color="muted">
        {`${formatMaskedNumber(step.inputSats, privacyMode)} → ${formatMaskedNumber(step.outputSats, privacyMode)} ${satsUnit}`}
      </SSText>
      <SiblingBranch
        count={step.siblingCount}
        sats={step.siblingSats}
        privacyMode={privacyMode}
      />
    </LineageNode>
  )
}

type SSArkVtxoLineageProps = {
  anchor: { txid: string; vout: number }
  steps: ArkVtxoLineageStep[]
  amountSats: number
  vtxoId: string
  privacyMode: boolean
}

function SSArkVtxoLineage({
  anchor,
  steps,
  amountSats,
  vtxoId,
  privacyMode
}: SSArkVtxoLineageProps) {
  const satsUnit = t('bitcoin.sats')
  const [expanded, setExpanded] = useState(false)
  const { head, hiddenCount, tail, tailStartIndex } = getArkVtxoLineageView(
    steps,
    expanded
  )

  return (
    <SSVStack gap="none">
      <LineageNode variant="anchor">
        <SSText size="xs" uppercase color="muted">
          {t('ark.vtxo.detail.lineage.anchor')}
        </SSText>
        <SSText size="xs" style={styles.mono}>
          {`${formatTxId(anchor.txid)}:${anchor.vout}`}
        </SSText>
        {steps.length === 0 && (
          <SSText size="xxs" color="muted">
            {t('ark.vtxo.detail.lineage.virtual')}
          </SSText>
        )}
      </LineageNode>
      {head.map((step, index) => (
        <StepNode
          key={step.txid}
          step={step}
          index={index}
          privacyMode={privacyMode}
        />
      ))}
      {hiddenCount > 0 && (
        <LineageNode variant="gap">
          <Pressable
            accessibilityRole="button"
            hitSlop={GAP_HIT_SLOP}
            onPress={() => setExpanded(true)}
          >
            <SSText size="xs" style={styles.gapLabel}>
              {t('ark.vtxo.detail.lineage.showHidden', { count: hiddenCount })}
            </SSText>
          </Pressable>
        </LineageNode>
      )}
      {tail.map((step, index) => (
        <StepNode
          key={step.txid}
          step={step}
          index={tailStartIndex + index}
          privacyMode={privacyMode}
        />
      ))}
      <LineageNode variant="leaf" isLast>
        <SSHStack justifyBetween>
          <SSText size="xs" uppercase>
            {t('ark.vtxo.detail.lineage.leaf')}
          </SSText>
          <SSText size="xs">
            {`${formatMaskedNumber(amountSats, privacyMode)} ${satsUnit}`}
          </SSText>
        </SSHStack>
        <SSText size="xs" style={styles.mono}>
          {formatTxId(vtxoId)}
        </SSText>
      </LineageNode>
    </SSVStack>
  )
}

const dotStyles = StyleSheet.create({
  anchor: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[400],
    borderWidth: 1
  },
  gap: {
    backgroundColor: Colors.gray[600],
    borderRadius: GAP_DOT_SIZE / 2,
    height: GAP_DOT_SIZE,
    marginTop: 6,
    width: GAP_DOT_SIZE
  },
  leaf: {
    backgroundColor: Colors.white,
    borderRadius: LEAF_DOT_SIZE / 2,
    height: LEAF_DOT_SIZE,
    width: LEAF_DOT_SIZE
  },
  step: {
    backgroundColor: Colors.gray[500]
  }
})

const styles = StyleSheet.create({
  body: {
    flex: 1
  },
  bodyGap: {
    paddingBottom: 18
  },
  branch: {
    alignItems: 'center',
    paddingTop: 4
  },
  branchLine: {
    backgroundColor: Colors.gray[700],
    height: 1,
    width: 12
  },
  dot: {
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    marginTop: 2,
    width: DOT_SIZE
  },
  gapLabel: {
    color: Colors.gray[300],
    textDecorationLine: 'underline'
  },
  line: {
    backgroundColor: Colors.gray[700],
    flex: 1,
    marginTop: 4,
    width: 1
  },
  mono: {
    fontFamily: Typography.geistMonoRegular
  },
  node: {
    alignItems: 'stretch'
  },
  rail: {
    alignItems: 'center',
    width: RAIL_WIDTH
  },
  siblingDot: {
    backgroundColor: Colors.gray[600],
    borderRadius: SIBLING_DOT_SIZE / 2,
    height: SIBLING_DOT_SIZE,
    width: SIBLING_DOT_SIZE
  }
})

export default SSArkVtxoLineage
