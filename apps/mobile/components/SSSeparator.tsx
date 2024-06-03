import { LinearGradient } from 'expo-linear-gradient'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { Colors } from '@/styles'

type SSSeparatorProps = {
  color?: 'grayDark' | 'gradient'
  colors?: string[]
  style?: StyleProp<ViewStyle>
}

export default function SSSeparator({
  color = 'gradient',
  colors,
  style
}: SSSeparatorProps) {
  return (
    <>
      {color === 'gradient' && (
        <LinearGradient
          style={[styles.containerBase, style]}
          colors={colors ? colors : [Colors.gray[700], Colors.gray[850]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      )}
      {color === 'grayDark' && (
        <View
          style={[
            styles.containerBase,
            { backgroundColor: Colors.gray[800] },
            style
          ]}
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
