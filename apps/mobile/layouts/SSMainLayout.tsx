import { View, StyleSheet } from 'react-native'
import { Layout } from '@/styles'

type SSMainLayoutProps = {
  children: React.ReactNode
}

export default function SSMainLayout({ children }: SSMainLayoutProps) {
  return <View style={styles.container}>{children}</View>
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    flex: 1
  }
})
