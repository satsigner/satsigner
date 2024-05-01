import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Colors, Layout } from '@/styles'

type SSMainLayoutProps = {
  black?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSMainLayout({
  black,
  style,
  children
}: SSMainLayoutProps) {
  const containerStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.containerBase,
        ...{ backgroundColor: black ? Colors.black : Colors.gray[950] }
      },
      [style]
    )
  }, [black, style])

  return <View style={containerStyle}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    flex: 1
  }
})
