import { useMemo } from 'react'
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
  const buttonStyle = useMemo(
    () =>
      StyleSheet.compose(
        {
          ...(rounded ? styles.rounded : {})
        },
        style
      ),
    [rounded, style]
  )

  return (
    <TouchableOpacity activeOpacity={0.65} style={buttonStyle} {...props}>
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
