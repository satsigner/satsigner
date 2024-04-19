import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'

type SSMainLayoutProps = {
  children: React.ReactNode
}

export default function SSMainLayout({ children }: SSMainLayoutProps) {
  return <View style={styles.containerBase}>{children}</View>
}

const styles = StyleSheet.create({
  containerBase: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    paddingBottom: Layout.mainContainer.paddingBottom,
    flex: 1
  }
})
