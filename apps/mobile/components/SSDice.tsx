import { type ReactNode } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle
} from 'react-native'

type SSDiceProps = {
  children: ReactNode
  onPress?: () => void
  style?: ViewStyle
}

function SSDice({ children, onPress, style }: SSDiceProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={1}
      style={[styles.wrapper, style]}
    >
      <View style={styles.dice}>{children}</View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    padding: 4,
    borderRadius: 12,
    opacity: 0.2
  },
  dice: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  }
})

export default SSDice
