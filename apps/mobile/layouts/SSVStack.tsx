import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import { type VStackGap } from '@/styles/layout'

type SSVStackProps = {
  gap?: VStackGap
  justifyBetween?: boolean
  itemsCenter?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({
  gap = 'md',
  justifyBetween,
  itemsCenter,
  children,
  style
}: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ gap: Layout.vStack.gap[gap] },
        ...(justifyBetween ? styles.justifyBetween : {}),
        ...(itemsCenter ? styles.itemsCenter : {})
      },
      style
    )
  }, [gap, justifyBetween, itemsCenter, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'column'
  },
  justifyBetween: {
    flex: 1,
    justifyContent: 'space-between'
  },
  itemsCenter: {
    alignItems: 'center'
  }
})
