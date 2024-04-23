import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet } from 'react-native'

import { Colors } from '@/styles'

export default function SSSeparator() {
  return (
    <LinearGradient
      style={styles.containerBase}
      colors={[Colors.gray[700], Colors.gray[850]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
    />
  )
}

const styles = StyleSheet.create({
  containerBase: {
    width: 'auto',
    height: 1
  }
})
