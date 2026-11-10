import { StyleSheet } from 'react-native'

import SSBackendSourceLabel from '@/components/SSBackendSourceLabel'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'
import type { ExplorerDataSource } from '@/types/explorer/capabilities'

type SSExplorerSectionHeaderProps = {
  title: string
  source: ExplorerDataSource | null
  sourceLabel: string | null
}

function SSExplorerSectionHeader({
  title,
  source,
  sourceLabel
}: SSExplorerSectionHeaderProps) {
  return (
    <SSHStack justifyBetween style={styles.header}>
      <SSText uppercase size="md" style={styles.title}>
        {title}
      </SSText>
      {source && sourceLabel ? (
        <SSBackendSourceLabel
          label={sourceLabel}
          isExternal={source !== 'backend'}
        />
      ) : null}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center'
  },
  title: {
    color: Colors.gray['400'],
    letterSpacing: 1.5
  }
})

export default SSExplorerSectionHeader
