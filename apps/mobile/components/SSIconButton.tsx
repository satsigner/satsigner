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
  const buttonStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...(rounded ? styles.rounded : {})
      },
      style
    )
  }, [rounded, style])

  return (
    <TouchableOpacity activeOpacity={0.65} style={buttonStyle} {...props}>
      {children}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  rounded: {
    borderColor: 'gray',
    backgroundColor: 'gray',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 20,
    padding: 5
  }
})

export default SSIconButton
