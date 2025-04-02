import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Block } from '@/types/models/Blockchain'
import { formatDate, formatTime } from '@/utils/format'

import SSText from './SSText'

type SSExploreBlockProps = {
  block: Block | null
}

function SSExploreBlock({ block }: SSExploreBlockProps) {
  const placeholder = '-'
  return (
    <SSVStack style={styles.centered} gap="none">
      <SSHStack gap="xs">
        <SSText weight="bold">{block?.height || '?'}</SSText>
      </SSHStack>
      <View style={styles.whiteRectangle} />
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
              {block
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
            <SSText weight="bold">{block?.tx_count || placeholder}</SSText>
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
  whiteRectangle: {
    width: 100,
    height: 100,
    backgroundColor: 'white',
    marginVertical: 15
  },
  centered: {
    alignItems: 'center'
  },
  halfWidth: {
    width: '45%'
  }
})

export default SSExploreBlock
