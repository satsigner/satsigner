import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

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
  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: black ? Colors.black : Colors.gray[950] }
      ]}
      edges={['bottom']}
    >
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop
  },
  safeArea: {
    flex: 1
  }
})
