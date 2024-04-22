import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import { type VStackGap } from '@/styles/layout'

type SSVStackProps = {
  gap?: VStackGap
  justifyEnd?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({
  gap = 'md',
  justifyEnd,
  children,
  style
}: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ gap: Layout.vStack.gap[gap] },
        ...(justifyEnd ? styles.justifyEnd : {})
      },
      style
    )
  }, [gap, justifyEnd, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flex: 1,
    flexDirection: 'column'
  },
  justifyEnd: {
    justifyContent: 'flex-end'
  }
})
