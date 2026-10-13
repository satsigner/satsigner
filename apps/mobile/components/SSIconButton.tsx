import { StyleSheet } from 'react-native'

import SSPressable from './SSPressable'

type SSIconButtonProps = {
  rounded?: boolean
} & React.ComponentPropsWithoutRef<typeof SSPressable>

function SSIconButton({
  rounded = false,
  style,
  children,
  ...props
}: SSIconButtonProps) {
  return (
    <SSPressable
      activeOpacity={0.65}
      style={[rounded && styles.rounded, style]}
      {...props}
    >
      {children}
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  rounded: {
    backgroundColor: 'gray',
    borderColor: 'gray',
    borderRadius: 20,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: 5
  }
})

export default SSIconButton
