import { StyleSheet } from 'react-native'

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
  const sourceStyle =
    source === 'backend' ? styles.sourceBackend : styles.sourceExternal

  return (
    <SSHStack justifyBetween style={styles.header}>
      <SSText uppercase size="md" style={styles.title}>
        {title}
      </SSText>
      {source && sourceLabel ? (
        <SSText size="xxs" style={sourceStyle}>
          {sourceLabel}
        </SSText>
      ) : null}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center'
  },
  sourceBackend: {
    color: Colors.mainGreen,
    opacity: 0.8
  },
  sourceExternal: {
    color: Colors.gray['500']
  },
  title: {
    color: Colors.gray['400'],
    letterSpacing: 1.5
  }
})

export default SSExplorerSectionHeader
