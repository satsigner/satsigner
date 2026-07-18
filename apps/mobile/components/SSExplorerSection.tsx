import { type ReactNode } from 'react'
import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import type { ExplorerDataSource } from '@/types/explorer/capabilities'

type SSExplorerSectionProps = {
  title: string
  source?: ExplorerDataSource | null
  sourceLabel?: string | null
  children: ReactNode
  gap?: 'none' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg'
}

function SSExplorerSection({
  title,
  source = null,
  sourceLabel = null,
  children,
  gap = 'sm'
}: SSExplorerSectionProps) {
  const sourceStyle =
    source === 'backend' ? styles.sourceBackend : styles.sourceExternal

  return (
    <SSVStack gap={gap}>
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
      {children}
    </SSVStack>
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
    color: Colors.gray[500]
  },
  title: {
    color: Colors.gray[200],
    letterSpacing: 1
  }
})

export default SSExplorerSection
