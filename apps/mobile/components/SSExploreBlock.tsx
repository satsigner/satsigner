import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { formatDate, formatTime } from '@/utils/format'

import SSText from './SSText'

type SSExploreBlockProps = {
  block: {
    hash: string
    height: number
    timestamp: number
    medianTime: number
    difficulty: number
    nonce: number
    weight: number
    size: number
    txCount: number
    version: number
    prevBlockHash: string
  }
  loading?: boolean
}

export default function SSExploreBlock({
  block,
  loading = false
}: SSExploreBlockProps) {
  return (
    <SSVStack style={styles.centered} gap="none">
      <SSHStack gap="xs">
        <SSText color="muted" uppercase>
          Block
        </SSText>
        <SSText weight="bold">{block.height}</SSText>
      </SSHStack>
      <View style={styles.whiteRectangle} />
      {loading ? (
        <SSText>Loading block details...</SSText>
      ) : (
        <SSVStack gap="md">
          <SSVStack gap="none">
            <SSText uppercase color="muted">Block Hash</SSText>
            <SSText weight="bold" type="mono">
              {block.hash}
            </SSText>
          </SSVStack>
          <SSHStack justifyBetween>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Date</SSText>
              <SSText weight="bold">
                {formatDate(block.timestamp)}{' '}
                {formatTime(new Date(block.timestamp))}
              </SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Date (median)</SSText>
              <SSText weight="bold">
                {formatDate(block.medianTime)}{' '}
                {formatTime(new Date(block.medianTime))}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Total transactions</SSText>
              <SSText weight="bold">{block.txCount}</SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Version</SSText>
              <SSText weight="bold">{block.version}</SSText>
            </SSVStack>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Nonce</SSText>
              <SSText weight="bold">{block.nonce}</SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Difficulty</SSText>
              <SSText weight="bold">{block.difficulty}</SSText>
            </SSVStack>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Size</SSText>
              <SSText weight="bold">{block.size}</SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.halfWidth}>
              <SSText uppercase color="muted">Weight</SSText>
              <SSText weight="bold">{block.weight}</SSText>
            </SSVStack>
          </SSHStack>
          <SSVStack gap="none">
            <SSText uppercase color="muted">Merkle Root</SSText>
            <SSText weight="bold" type="mono">
              {block.merkleRoot}
            </SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText uppercase color="muted">Previous block hash</SSText>
            <SSText weight="bold" type="mono">
              {block.prevBlockHash}
            </SSText>
          </SSVStack>
        </SSVStack>
      )}
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
