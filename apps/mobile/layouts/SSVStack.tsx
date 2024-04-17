import { StyleSheet, View } from 'react-native'

import { Layout } from '@/styles'

type SSVStackProps = {
  children: React.ReactNode
}

export default function SSVStack({ children }: SSVStackProps) {
  return <View style={styles.container}>{children}</View>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    gap: Layout.vStack.gap
  }
})
