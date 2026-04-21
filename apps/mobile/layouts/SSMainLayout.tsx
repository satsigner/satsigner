import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Colors, Layout } from '@/styles'

type SSMainLayoutProps = {
  backgroundColor?: string
  black?: boolean
  children: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof View>

export default function SSMainLayout({
  backgroundColor,
  black,
  style,
  children
}: SSMainLayoutProps) {
  const resolvedBackground =
    backgroundColor ?? (black ? Colors.black : Colors.gray[950])

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: resolvedBackground }]}
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
