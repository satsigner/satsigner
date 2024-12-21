import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'
import { type VStackGap } from '@/styles/layout'

type SSVStackProps = {
  gap?: VStackGap
  justifyBetween?: boolean
  itemsCenter?: boolean
  widthFull?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({
  gap = 'md',
  justifyBetween,
  itemsCenter,
  widthFull,
  children,
  style
}: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ gap: Layout.vStack.gap[gap] },
        ...(justifyBetween ? styles.justifyBetween : {}),
        ...(itemsCenter ? styles.itemsCenter : {}),
        ...(widthFull ? styles.widthFull : {})
      },
      style
    )
  }, [gap, justifyBetween, itemsCenter, widthFull, style])

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
  },
  widthFull: {
    width: '100%'
  }
})
