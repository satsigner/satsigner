import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native'

import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'

type SSBalanceChangeBarProps = {
  balance?: number
  transaction?: Transaction
  maxBalance?: number
  style?: StyleProp<ViewStyle>
}

function SSBalanceChangeBar({
  balance = 0,
  transaction,
  maxBalance = 1,
  style
}: SSBalanceChangeBarProps) {
  if (!transaction) return null

  const safeMaxBalance = maxBalance || 1

  const percentages =
    transaction.type === 'receive'
      ? [
          Math.max(0, (balance - transaction.received) / safeMaxBalance),
          balance / safeMaxBalance,
          1
        ]
      : [
          balance / safeMaxBalance,
          Math.max(
            0,
            (balance + transaction.sent - transaction.received) / safeMaxBalance
          ),
          1
        ]

  const colors =
    transaction.type === 'receive'
      ? [Colors.softBarGreen, Colors.barGreen, Colors.barGray]
      : [Colors.softBarRed, Colors.barRed, Colors.barGray]

  return (
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
      <View style={[styles.segment, { backgroundColor: colors[2], flex: 1 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    width: '100%',
    height: 1.5,
    flexDirection: 'row'
  },
  segment: {
    height: '100%'
  }
})

export default SSBalanceChangeBar
