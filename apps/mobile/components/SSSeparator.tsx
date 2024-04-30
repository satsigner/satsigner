import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'

import { Colors } from '@/styles'

type SSSeparatorProps = {
  color: 'grayDark' | 'gradient'
}

export default function SSSeparator({ color = 'gradient' }: SSSeparatorProps) {
  return (
    <>
      {color === 'gradient' && (
        <LinearGradient
          style={styles.containerBase}
          colors={[Colors.gray[700], Colors.gray[850]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      )}
      {color === 'grayDark' && (
        <View
          style={[styles.containerBase, { backgroundColor: Colors.gray[800] }]}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    width: 'auto',
    height: 1
  }
})
