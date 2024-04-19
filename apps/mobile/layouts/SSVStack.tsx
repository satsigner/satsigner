import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'

type SSVStackProps = {
  justifyEnd?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({
  justifyEnd,
  children,
  style
}: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...(justifyEnd ? styles.justifyEnd : {})
      },
      style
    )
  }, [justifyEnd, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    flex: 1,
    flexDirection: 'column',
    gap: Layout.vStack.gap
  },
  justifyEnd: {
    justifyContent: 'flex-end'
  }
})
