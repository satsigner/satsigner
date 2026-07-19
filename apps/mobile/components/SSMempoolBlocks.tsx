import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import type { MemPoolBlock } from '@/types/models/Blockchain'
import { formatNumber } from '@/utils/format'

const MINUTES_PER_BLOCK = 10

type SSMempoolBlocksProps = {
  blocks: MemPoolBlock[]
  /** Histogram-derived buckets (not CPFP-aware packing). */
  approximate?: boolean
}

function entryFeeRate(block: MemPoolBlock): number {
  const [minFee] = block.feeRange
  return minFee ?? block.medianFee
}

type BacklogRowProps = {
  block: MemPoolBlock
  index: number
}

function BacklogRow({ block, index }: BacklogRowProps) {
  return (
    <SSHStack justifyBetween style={styles.row}>
      <SSText size="sm" color="muted" style={styles.eta}>
        {t('explorer.mempool.pendingBlock.eta', { n: index + 1 })}
      </SSText>
      <SSText size="sm" type="mono" style={styles.fee}>
        {t('explorer.mempool.pendingBlock.minFee', {
          rate: formatNumber(entryFeeRate(block), 1)
        })}
      </SSText>
      {block.nTx > 0 ? (
        <SSText size="sm" color="muted" type="mono" style={styles.txs}>
          {t('explorer.mempool.pendingBlock.nTxShort', {
            n: formatNumber(block.nTx)
          })}
        </SSText>
      ) : null}
    </SSHStack>
  )
}

export default function SSMempoolBlocks({
  blocks,
  approximate = false
}: SSMempoolBlocksProps) {
  if (blocks.length === 0) {
    return null
  }

  const minutes = blocks.length * MINUTES_PER_BLOCK

  return (
    <SSVStack gap="sm">
      <SSText size="sm">
        {t('explorer.mempool.pendingBlocksSummary', {
          blocks: blocks.length,
          minutes
        })}
      </SSText>
      <SSText size="xxs" color="muted">
        {approximate
          ? t('explorer.mempool.pendingBlocksHintApproximate')
          : t('explorer.mempool.pendingBlocksHint')}
      </SSText>
      <SSVStack gap="xxs">
        {blocks.map((block, index) => (
          <BacklogRow key={index} block={block} index={index} />
        ))}
      </SSVStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  eta: {
    width: 36
  },
  fee: {
    color: Colors.gray[100],
    flex: 1,
    textAlign: 'left'
  },
  row: {
    alignItems: 'center',
    paddingVertical: Layout.vStack.gap.xxs
  },
  txs: {
    minWidth: 72,
    textAlign: 'right'
  }
})
