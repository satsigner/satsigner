import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { Colors, Layout } from '@/styles'
import { SafeAreaView } from 'react-native-safe-area-context'

type SSMainLayoutProps = {
  black?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSMainLayout({
  black,
  style,
  children
}: SSMainLayoutProps) {
  const containerStyle = useMemo(
    () =>
      StyleSheet.compose(
        {
          ...styles.containerBase,
          ...{ backgroundColor: black ? Colors.black : Colors.gray[950] }
        },
        [style],
      ),
    [black, style]
  )

  return <SafeAreaView style={containerStyle} edges={['bottom']}>{children}</SafeAreaView>
}

const styles = StyleSheet.create({
  containerBase: {
    flex: 1,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop
  }
})
