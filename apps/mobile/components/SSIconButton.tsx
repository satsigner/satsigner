import { StyleSheet, TouchableOpacity } from 'react-native'

type SSIconButtonProps = {
  rounded?: boolean
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function SSIconButton({
  rounded = false,
  style,
  children,
  ...props
}: SSIconButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      style={[rounded && styles.rounded, style]}
      {...props}
    >
      {children}
    </TouchableOpacity>
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
