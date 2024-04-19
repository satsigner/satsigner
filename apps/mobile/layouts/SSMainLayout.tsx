import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Colors, Layout } from '@/styles'

type SSMainLayoutProps = {
  black?: boolean
  children: React.ReactNode
}

export default function SSMainLayout({ black, children }: SSMainLayoutProps) {
  const containerStyle = useMemo(() => {
    return { backgroundColor: black ? Colors.black : Colors.gray[950] }
  }, [black])

  return <View style={[styles.containerBase, containerStyle]}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    paddingBottom: Layout.mainContainer.paddingBottom,
    flex: 1
  }
})
