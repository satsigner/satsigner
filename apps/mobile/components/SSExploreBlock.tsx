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
}

function blockWeightPercentage(weight: number) {
  return (100 * weight) / 4_000_000
}

function formatBlockDate(timestamp?: number) {
  if (!timestamp) return ''
  const date = formatDate(timestamp * 1000)
  const time = formatTime(new Date(timestamp * 1000))
  return `${date} ${time}`
}

function formatBlockHash(hash?: string) {
  if (!hash) return ''
  return hash.startsWith('0000') ? hash : hash.split('').reverse().join('')
}

function SSExploreBlock({ block }: SSExploreBlockProps) {
  const weight = block?.weight || 0
  const percentageWeight = blockWeightPercentage(weight)
  return (
    <SSVStack style={styles.centered} gap="none">
      <SSHStack gap="xs">
        <SSText weight="bold">{block?.height || '?'}</SSText>
      </SSHStack>
      <View style={{ marginBottom: 15, marginTop: 5 }}>
        <View
          style={[
            styles.rectangle,
            {
              height: 100 - percentageWeight,
              backgroundColor: Colors.white
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
              height: percentageWeight,
              backgroundColor: Colors.gray['300'],
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
            { width: '100%', copyToClipboard: true }
          ],
          [t('explorer.block.date'), formatBlockDate(block?.timestamp)],
          [t('explorer.block.dateMedian'), formatBlockDate(block?.mediantime)],
          [
            t('explorer.block.txCount'),
            block?.tx_count ? `${block.tx_count} (view transactions)` : '',
            { navigateToLink: `/explorer/block/${block?.id}/transactions` }
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
  rectangle: {
    width: 100,
    backgroundColor: 'white',
    justifyContent: 'center'
  },
  centered: {
    alignItems: 'center'
  },
  halfWidth: {
    width: '45%'
  }
})

export default SSExploreBlock
