import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Layout } from '@/styles'
import { type Block as BaseBlock } from '@/types/models/Blockchain'
import type { PartialSome } from '@/types/utils'
import { formatDate, formatNumber, formatTime } from '@/utils/format'

import SSDetailsList from './SSDetailsList'

export type Block = PartialSome<
  BaseBlock,
  'merkle_root' | 'mediantime' | 'tx_count' | 'previousblockhash'
>

type SSExploreBlockProps = {
  block: Block | null
  sourceLabel?: string
  canViewTransactions?: boolean
}

/** Consensus weight limit (BIP141). */
const MAX_BLOCK_WEIGHT = 4_000_000
/** Virtual-size capacity: weight ÷ 4. */
const MAX_BLOCK_VBYTES = MAX_BLOCK_WEIGHT / 4
/** Absolute serialized-size ceiling (Bitcoin Core MAX_BLOCK_SERIALIZED_SIZE). */
const MAX_BLOCK_SERIALIZED_BYTES = 4_000_000
/** Never claim 100% empty when the block has any weight (rounding would hide it). */
const MAX_EMPTY_DISPLAY_PERCENT = 99.9
/** Keep a visible sliver of the filled bar for near-empty blocks. */
const MIN_BAR_FILL_PERCENT = 1

function blockWeightPercentage(weight: number) {
  if (weight <= 0) {
    return 0
  }
  return (100 * weight) / MAX_BLOCK_WEIGHT
}

function blockEmptyDisplayPercentage(fillPercentage: number) {
  if (fillPercentage <= 0) {
    return 100
  }
  return Math.min(MAX_EMPTY_DISPLAY_PERCENT, 100 - fillPercentage)
}

function blockBarFillPercentage(fillPercentage: number) {
  if (fillPercentage <= 0) {
    return 0
  }
  return Math.max(MIN_BAR_FILL_PERCENT, fillPercentage)
}

function blockVirtualSize(weight: number) {
  if (weight <= 0) {
    return 0
  }
  return Math.ceil(weight / 4)
}

function formatBlockDate(timestamp?: number) {
  if (!timestamp) {
    return ''
  }
  const date = formatDate(timestamp * 1000)
  const time = formatTime(new Date(timestamp * 1000))
  return `${date} ${time}`
}

function formatBlockHash(hash?: string) {
  if (!hash) {
    return ''
  }
  return hash.startsWith('0000') ? hash : hash.split('').toReversed().join('')
}

type CapacityRowProps = {
  label: string
  hint: string
  value: string
}

function CapacityRow({ label, hint, value }: CapacityRowProps) {
  return (
    <SSVStack gap="none" style={styles.capacityRow}>
      <SSHStack justifyBetween style={styles.capacityRowHeader}>
        <SSText size="xs" weight="medium">
          {label}
        </SSText>
        <SSText size="xs" type="mono">
          {value}
        </SSText>
      </SSHStack>
      <SSText size="xxs" color="muted">
        {hint}
      </SSText>
    </SSVStack>
  )
}

function SSExploreBlock({
  block,
  sourceLabel,
  canViewTransactions = false
}: SSExploreBlockProps) {
  const router = useRouter()
  const weight = block?.weight || 0
  const size = block?.size || 0
  const vsize = blockVirtualSize(weight)
  const percentageWeight = blockWeightPercentage(weight)
  const emptyDisplayPercentage = blockEmptyDisplayPercentage(percentageWeight)
  const barFillPercentage = blockBarFillPercentage(percentageWeight)
  const showCapacity = Boolean(block && (size > 0 || weight > 0))
  // Electrum maps size as weight * 4 (not serialized bytes). Hide that fake size.
  const sizeIsApproximate = weight > 0 && size === weight * 4
  const showSerializedSize = size > 0 && !sizeIsApproximate
  const txCount = block?.tx_count
  const canOpenTransactions =
    canViewTransactions && Boolean(block?.id) && typeof txCount === 'number'

  function openTransactions() {
    if (!canOpenTransactions || !block?.id) {
      return
    }
    router.push(`/explorer/block/${block.id}/transactions`)
  }

  return (
    <SSVStack style={styles.centered} gap="none">
      <SSVStack gap="xxs" style={styles.centered}>
        <SSHStack gap="xs">
          <SSText weight="bold">{block?.height || '?'}</SSText>
        </SSHStack>
        {sourceLabel ? (
          <SSText size="xxs" style={styles.sourceLabel}>
            {sourceLabel}
          </SSText>
        ) : null}
        {typeof txCount === 'number' ? (
          <Pressable
            accessibilityRole={canOpenTransactions ? 'button' : undefined}
            disabled={!canOpenTransactions}
            onPress={openTransactions}
            style={styles.txCountBlock}
          >
            <SSText size="3xl" weight="bold" type="mono" center>
              {formatNumber(txCount)}
            </SSText>
            <SSText size="xs" color="muted" center uppercase>
              {t('explorer.block.txCount')}
            </SSText>
            {canOpenTransactions ? (
              <SSText size="xxs" color="muted" center>
                {t('explorer.block.viewTransactions')}
              </SSText>
            ) : null}
          </Pressable>
        ) : null}
      </SSVStack>
      <SSVStack gap="sm" style={styles.capacitySection}>
        <View style={styles.barWrap}>
          <View
            style={[
              styles.rectangle,
              {
                backgroundColor: Colors.white,
                height: 100 - barFillPercentage
              }
            ]}
          >
            {block?.tx_count && percentageWeight <= 30 ? (
              <SSText center size="xs" color="black">
                {t('explorer.block.percentageEmpty', {
                  percentage: formatNumber(emptyDisplayPercentage, 1)
                })}
              </SSText>
            ) : null}
          </View>
          <View
            style={[
              styles.rectangle,
              {
                backgroundColor: Colors.gray['300'],
                height: barFillPercentage,
                justifyContent: 'center'
              }
            ]}
          >
            {block?.tx_count && percentageWeight > 30 ? (
              <SSText center size="xs">
                {t('explorer.block.percentageFull', {
                  percentage: formatNumber(percentageWeight, 1)
                })}
              </SSText>
            ) : null}
          </View>
        </View>
        {showCapacity ? (
          <SSVStack gap="xs" style={styles.capacityStats}>
            <CapacityRow
              label={t('explorer.block.capacity.vbytesLabel')}
              hint={t('explorer.block.capacity.vbytesHint')}
              value={t('explorer.block.capacity.vbytes', {
                max: formatNumber(MAX_BLOCK_VBYTES),
                used: formatNumber(vsize)
              })}
            />
            {showSerializedSize ? (
              <CapacityRow
                label={t('explorer.block.capacity.sizeLabel')}
                hint={t('explorer.block.capacity.sizeHint')}
                value={t('explorer.block.capacity.size', {
                  max: formatNumber(MAX_BLOCK_SERIALIZED_BYTES),
                  used: formatNumber(size)
                })}
              />
            ) : null}
            <SSText size="xxs" color="muted" center>
              {t('explorer.block.capacity.note')}
            </SSText>
          </SSVStack>
        ) : null}
      </SSVStack>
      <SSDetailsList
        columns={2}
        items={[
          [
            t('explorer.block.id'),
            formatBlockHash(block?.id),
            { copyToClipboard: true, width: '100%' }
          ],
          [t('explorer.block.date'), formatBlockDate(block?.timestamp)],
          [t('explorer.block.dateMedian'), formatBlockDate(block?.mediantime)],
          [t('explorer.block.version'), block?.version],
          [t('explorer.block.nonce'), block?.nonce],
          [t('explorer.block.difficulty'), block?.difficulty],
          [
            t('explorer.block.weight'),
            weight
              ? `${formatNumber(weight)} / ${formatNumber(MAX_BLOCK_WEIGHT)} WU`
              : ''
          ],
          [
            t('explorer.block.merkleRoot'),
            block?.merkle_root,
            { width: '100%' }
          ],
          [
            t('explorer.block.prevHash'),
            formatBlockHash(block?.previousblockhash),
            { width: '100%' }
          ]
        ]}
      />
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  barWrap: {
    alignItems: 'center'
  },
  capacityRow: {
    width: '100%'
  },
  capacityRowHeader: {
    width: '100%'
  },
  capacitySection: {
    alignItems: 'center',
    marginBottom: Layout.vStack.gap.md,
    marginTop: Layout.vStack.gap.xs,
    width: '100%'
  },
  capacityStats: {
    width: '100%'
  },
  centered: {
    alignItems: 'center'
  },
  rectangle: {
    backgroundColor: 'white',
    justifyContent: 'center',
    width: 100
  },
  sourceLabel: {
    color: Colors.mainGreen,
    opacity: 0.8
  },
  txCountBlock: {
    alignItems: 'center',
    marginTop: Layout.vStack.gap.xs
  }
})

export default SSExploreBlock
