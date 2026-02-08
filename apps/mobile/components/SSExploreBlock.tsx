import { router } from 'expo-router'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Block as BaseBlock } from '@/types/models/Blockchain'
import { formatDate, formatNumber, formatTime } from '@/utils/format'

type SomePartial<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: T[P] | undefined
}

export type Block = SomePartial<
  BaseBlock,
  'merkle_root' | 'mediantime' | 'tx_count' | 'previousblockhash'
>

// ouch
type SSExploreBlockProps = {
  block: Block | null
}

/**
 * @param weight - The block weight in virtual bytes
 * @returns Percentage of the maximum block weight
 */
function blockWeightPercentage(weight: number) {
  return (100 * weight) / 4_000_000
}

function SSExploreBlock({ block }: SSExploreBlockProps) {
  const placeholder = '-'
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
          {block && percentageWeight <= 30 && (
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
          {percentageWeight > 30 && (
            <SSText center size="xs">
              {t('explorer.block.percentageFull', {
                percentage: formatNumber(percentageWeight)
              })}
            </SSText>
          )}
        </View>
      </View>
      <SSVStack gap="md">
        <SSVStack gap="none">
          <SSText uppercase color="muted">
            {t('explorer.block.id')}
          </SSText>
          <SSText weight="bold" type="mono">
            {block?.id || placeholder}
          </SSText>
        </SSVStack>
        <SSHStack justifyBetween>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.date')}
            </SSText>
            <SSText weight="bold">
              {block
                ? formatDate(block.timestamp * 1000) +
                  ' ' +
                  formatTime(new Date(block.timestamp * 1000))
                : placeholder}
            </SSText>
          </SSVStack>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.dateMedian')}
            </SSText>
            <SSText weight="bold">
              {block && block.mediantime
                ? formatDate(block.mediantime * 1000) +
                  ' ' +
                  formatTime(new Date(block.mediantime * 1000))
                : placeholder}
            </SSText>
          </SSVStack>
        </SSHStack>
        <SSHStack justifyBetween>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.txCount')}
            </SSText>
            <SSHStack
              style={{
                justifyContent: 'space-between',
                alignItems: 'baseline'
              }}
            >
              <SSText weight="bold">{block?.tx_count || placeholder}</SSText>
              {block?.tx_count && (
                <TouchableOpacity
                  onPress={() => {
                    router.navigate(`/explorer/block/${block.id}/transactions`)
                  }}
                >
                  <SSText color="muted" size="xs">
                    (view transactions)
                  </SSText>
                </TouchableOpacity>
              )}
            </SSHStack>
          </SSVStack>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.version')}
            </SSText>
            <SSText weight="bold">{block?.version || placeholder}</SSText>
          </SSVStack>
        </SSHStack>
        <SSHStack justifyBetween>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.nonce')}
            </SSText>
            <SSText weight="bold">{block?.nonce || placeholder}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.difficulty')}
            </SSText>
            <SSText weight="bold">{block?.difficulty || placeholder}</SSText>
          </SSVStack>
        </SSHStack>
        <SSHStack justifyBetween>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.size')}
            </SSText>
            <SSText weight="bold">{block?.size || placeholder}</SSText>
          </SSVStack>
          <SSVStack gap="none" style={styles.halfWidth}>
            <SSText uppercase color="muted">
              {t('explorer.block.weight')}
            </SSText>
            <SSText weight="bold">{block?.weight || placeholder}</SSText>
          </SSVStack>
        </SSHStack>
        <SSVStack gap="none">
          <SSText uppercase color="muted">
            {t('explorer.block.merkleRoot')}
          </SSText>
          <SSText weight="bold" type="mono">
            {block?.merkle_root || placeholder}
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSText uppercase color="muted">
            {t('explorer.block.prevHash')}
          </SSText>
          <SSText weight="bold" type="mono">
            {block?.previousblockhash || placeholder}
          </SSText>
        </SSVStack>
      </SSVStack>
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
