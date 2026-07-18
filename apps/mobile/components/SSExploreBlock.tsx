import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
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

function blockWeightPercentage(weight: number) {
  return (100 * weight) / 4_000_000
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

function SSExploreBlock({
  block,
  sourceLabel,
  canViewTransactions = false
}: SSExploreBlockProps) {
  const weight = block?.weight || 0
  const percentageWeight = blockWeightPercentage(weight)
  const txCountLabel = block?.tx_count
    ? canViewTransactions
      ? `${block.tx_count} (${t('explorer.block.viewTransactions')})`
      : `${block.tx_count}`
    : ''
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
      </SSVStack>
      <View style={{ marginBottom: 15, marginTop: 5 }}>
        <View
          style={[
            styles.rectangle,
            {
              backgroundColor: Colors.white,
              height: 100 - percentageWeight
            }
          ]}
        >
          {block?.tx_count && percentageWeight <= 30 && (
            <SSText center size="xs" color="black">
              {t('explorer.block.percentageEmpty', {
                percentage: formatNumber(100 - percentageWeight, 1)
              })}
            </SSText>
          )}
        </View>
        <View
          style={[
            styles.rectangle,
            {
              backgroundColor: Colors.gray['300'],
              height: percentageWeight,
              justifyContent: 'center'
            }
          ]}
        >
          {block?.tx_count && percentageWeight > 30 && (
            <SSText center size="xs">
              {t('explorer.block.percentageFull', {
                percentage: formatNumber(percentageWeight)
              })}
            </SSText>
          )}
        </View>
      </View>
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
          [
            t('explorer.block.txCount'),
            txCountLabel,
            canViewTransactions && block?.id
              ? {
                  navigateToLink: `/explorer/block/${block.id}/transactions`
                }
              : {}
          ],
          [t('explorer.block.version'), block?.version],
          [t('explorer.block.nonce'), block?.nonce],
          [t('explorer.block.difficulty'), block?.difficulty],
          [t('explorer.block.size'), block?.size],
          [t('explorer.block.weight'), block?.weight],
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
  centered: {
    alignItems: 'center'
  },
  halfWidth: {
    width: '45%'
  },
  rectangle: {
    backgroundColor: 'white',
    justifyContent: 'center',
    width: 100
  },
  sourceLabel: {
    color: Colors.mainGreen,
    opacity: 0.8
  }
})

export default SSExploreBlock
