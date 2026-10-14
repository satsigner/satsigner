import { type ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import SSPressable from './SSPressable'

type SSDiceProps = {
  children: ReactNode
  onPress?: () => void
  selected?: boolean
  style?: ViewStyle
}

function SSDice({ children, onPress, selected = false, style }: SSDiceProps) {
  return (
    <SSPressable
      onPress={onPress}
      activeOpacity={1}
      style={[styles.wrapper, selected && styles.selected, style]}
    >
      <View style={styles.dice}>{children}</View>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  dice: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center'
  },
  selected: {
    opacity: 1
  },
  wrapper: {
    borderRadius: 12,
    opacity: 0.2,
    padding: 4
  }
})

export default SSDice
