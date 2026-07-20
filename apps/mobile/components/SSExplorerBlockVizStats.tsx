import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { ExplorerBlockExtras } from '@/types/explorer/blockViz'
import { formatNumber } from '@/utils/format'

type SSExplorerBlockVizStatsProps = {
  extras: ExplorerBlockExtras
  txCount: number
}

type StatRowProps = {
  label: string
  value: string
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <SSHStack justifyBetween>
      <SSText size="sm" color="muted">
        {label}
      </SSText>
      <SSText size="sm">{value}</SSText>
    </SSHStack>
  )
}

function formatOptional(value: number | null, digits = 0): string {
  if (value === null) {
    return '--'
  }
  return formatNumber(value, digits)
}

function SSExplorerBlockVizStats({
  extras,
  txCount
}: SSExplorerBlockVizStatsProps) {
  const segwitPercent =
    extras.segwitTotalTxs !== null && txCount > 0
      ? (100 * extras.segwitTotalTxs) / txCount
      : null

  return (
    <SSVStack gap="xs">
      <StatRow
        label={t('explorer.block.viz.pool')}
        value={extras.pool?.name ?? '--'}
      />
      <StatRow
        label={t('explorer.block.viz.totalFees')}
        value={`${formatOptional(extras.totalFees)} sats`}
      />
      <StatRow
        label={t('explorer.block.viz.reward')}
        value={`${formatOptional(extras.reward)} sats`}
      />
      <StatRow
        label={t('explorer.block.viz.avgFeeRate')}
        value={
          extras.avgFeeRate !== null
            ? `${formatNumber(extras.avgFeeRate, 1)} sat/vB`
            : '--'
        }
      />
      <StatRow
        label={t('explorer.block.viz.avgFee')}
        value={
          extras.avgFee !== null
            ? `${formatNumber(extras.avgFee, 0)} sats`
            : '--'
        }
      />
      <StatRow
        label={t('explorer.block.viz.avgTxSize')}
        value={
          extras.avgTxSize !== null
            ? `${formatNumber(extras.avgTxSize, 0)} B`
            : '--'
        }
      />
      <StatRow
        label={t('explorer.block.viz.virtualSize')}
        value={
          extras.virtualSize !== null
            ? `${formatNumber(extras.virtualSize, 0)} vB`
            : '--'
        }
      />
      <StatRow
        label={t('explorer.block.viz.inputsOutputs')}
        value={`${formatOptional(extras.totalInputs)} / ${formatOptional(extras.totalOutputs)}`}
      />
      <StatRow
        label={t('explorer.block.viz.segwitShare')}
        value={
          segwitPercent !== null ? `${formatNumber(segwitPercent, 1)}%` : '--'
        }
      />
      <StatRow
        label={t('explorer.block.viz.matchRate')}
        value={
          extras.matchRate !== null
            ? `${formatNumber(extras.matchRate, 0)}%`
            : '--'
        }
      />
    </SSVStack>
  )
}

export default SSExplorerBlockVizStats
