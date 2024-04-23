import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import { type VStackGap } from '@/styles/layout'

type SSVStackProps = {
  gap?: VStackGap
  justifyEnd?: boolean
  itemsCenter?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({
  gap = 'md',
  justifyEnd,
  itemsCenter,
  children,
  style
}: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ gap: Layout.vStack.gap[gap] },
        ...(justifyEnd ? styles.justifyEnd : {}),
        ...(itemsCenter ? styles.itemsCenter : {})
      },
      style
    )
  }, [gap, justifyEnd, itemsCenter, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'column'
  },
  justifyEnd: {
    justifyContent: 'flex-end'
  },
  itemsCenter: {
    alignItems: 'center'
  }
})
