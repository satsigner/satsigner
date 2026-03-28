import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

import { Colors } from '@/styles'

type SSUtxoBarProps = {
  utxoValue: number
  totalBalance: number
  style?: StyleProp<ViewStyle>
}

function SSUtxoBar({ utxoValue, totalBalance, style }: SSUtxoBarProps) {
  const safeTotalBalance = totalBalance || 1
  const percentage = Math.min(utxoValue / safeTotalBalance, 1)

  return (
    <View style={[styles.containerBase, style]}>
      <View
        style={[
          styles.segment,
          { backgroundColor: Colors.white, width: `${percentage * 100}%` }
        ]}
      />
      <View
        style={[styles.segment, { backgroundColor: Colors.gray[800], flex: 1 }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    flexDirection: 'row',
    height: 1.5,
    width: '100%'
  },
  segment: {
    height: '100%'
  }
})

export default SSUtxoBar
