import { useMemo } from 'react'
import { StyleSheet, TextInput } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSTextInputProps = {
  variant?: 'default' | 'outline'
  size?: 'default' | 'small'
  align?: 'center' | 'left'
} & React.ComponentPropsWithoutRef<typeof TextInput>

export default function SSTextInput({
  variant = 'default',
  size = 'default',
  align = 'center',
  style,
  ...props
}: SSTextInputProps) {
  const textInputStyle = useMemo(() => {
    const variantStyle =
      variant === 'default' ? styles.variantDefault : styles.variantOutline

    const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall

    const alignStyle =
      align === 'center' ? styles.alignCenter : styles.alignLeft

    return StyleSheet.compose(
      {
        ...styles.textInputBase,
        ...variantStyle,
        ...sizeStyle,
        ...alignStyle
      },
      style
    )
  }, [variant, size, align, style])

  return (
    <TextInput
      placeholderTextColor={Colors.gray[400]}
      style={textInputStyle}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  textInputBase: {
    borderRadius: Sizes.textInput.borderRadius,
    width: '100%',
    textAlign: 'center',
    color: Colors.white
  },
  variantDefault: {
    backgroundColor: Colors.gray[850]
  },
  variantOutline: {
    borderWidth: 1,
    borderColor: Colors.gray[400]
  },
  sizeDefault: {
    fontSize: Sizes.textInput.fontSize.default,
    height: Sizes.textInput.height.default
  },
  sizeSmall: {
    fontSize: Sizes.textInput.fontSize.small,
    height: Sizes.textInput.height.small
  },
  alignCenter: {
    textAlign: 'center'
  },
  alignLeft: {
    textAlign: 'left',
    paddingHorizontal: 12
  }
})
