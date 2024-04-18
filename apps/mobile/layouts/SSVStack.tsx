import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'

type SSVStackProps = {
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSVStack({ children, style }: SSVStackProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(styles.container, style)
  }, [style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    gap: Layout.vStack.gap
  }
})
