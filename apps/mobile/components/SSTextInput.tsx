import { type ForwardedRef, forwardRef, useMemo } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSTextInputProps = {
  variant?: 'default' | 'outline'
  size?: 'default' | 'small'
  align?: 'center' | 'left'
  actionRight?: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSTextInput(
  {
    variant = 'default',
    size = 'default',
    align = 'center',
    actionRight,
    style,
    ...props
  }: SSTextInputProps,
  ref: ForwardedRef<TextInput>
) {
  const textInputStyle = useMemo(() => {
    const variantStyle =
      variant === 'default' ? styles.variantDefault : styles.variantOutline

    const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall

    const alignStyle =
      align === 'center' ? styles.alignCenter : styles.alignLeft

    const actionRightPadding = actionRight ? { paddingRight: 48 } : {}

    return StyleSheet.compose(
      {
        ...styles.textInputBase,
        ...variantStyle,
        ...sizeStyle,
        ...alignStyle,
        ...actionRightPadding
      },
      style
    )
  }, [variant, size, align, actionRight, style])

  return (
    <View style={styles.containerBase}>
      <TextInput
        ref={ref}
        placeholderTextColor={Colors.gray[400]}
        style={textInputStyle}
        {...props}
      />
      <View style={styles.actionRightBase}>{actionRight}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionRightBase: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -12 }]
  },
  alignCenter: {
    paddingHorizontal: 12,
    textAlign: 'center'
  },
  alignLeft: {
    paddingHorizontal: 12,
    textAlign: 'left'
  },
  containerBase: {
    position: 'relative',
    width: '100%'
  },
  sizeDefault: {
    fontSize: Sizes.textInput.fontSize.default,
    height: Sizes.textInput.height.default
  },
  sizeSmall: {
    fontSize: Sizes.textInput.fontSize.small,
    height: Sizes.textInput.height.small
  },
  textInputBase: {
    borderRadius: Sizes.textInput.borderRadius,
    color: Colors.white,
    textAlign: 'center',
    width: '100%'
  },
  variantDefault: {
    backgroundColor: Colors.gray[850]
  },
  variantOutline: {
    borderColor: Colors.gray[400],
    borderWidth: 1
  }
})

export default forwardRef(SSTextInput)
