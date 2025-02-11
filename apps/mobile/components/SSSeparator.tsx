import { LinearGradient } from 'expo-linear-gradient'
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

import { Colors } from '@/styles'

type SSSeparatorProps = {
  color?: 'grayDark' | 'gradient' | 'custom'
  colors?: string[]
  percentages?: number[]
  style?: StyleProp<ViewStyle>
}

function SSSeparator({
  color = 'gradient',
  colors = [Colors.gray[700], Colors.gray[800], Colors.gray[850]],
  percentages = [0.05, 0.6, 1],
  style
}: SSSeparatorProps) {
  return (
    <>
      {color === 'custom' && (
        <View style={[styles.containerBase, style]}>
          <View
            style={[
              styles.segment,
              { backgroundColor: colors[0], width: `${percentages[0] * 100}%` }
            ]}
          />
          <View
            style={[
              styles.segment,
              {
                backgroundColor: colors[1],
                width: `${(percentages[1] - percentages[0]) * 100}%`
              }
            ]}
          />
          <View
            style={[styles.segment, { backgroundColor: colors[2], flex: 1 }]}
          />
        </View>
      )}
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
    height: 1.5,
    flexDirection: 'row'
  },
  segment: {
    height: '100%'
  }
})

export default SSSeparator
