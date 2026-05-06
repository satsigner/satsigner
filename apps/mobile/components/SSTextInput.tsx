import { type ForwardedRef, forwardRef } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { Colors, Sizes } from '@/styles'
import { descriptorValidityCache } from '@/utils/validation'

export type SSTextInputProps = {
  variant?: 'default' | 'outline'
  size?: 'default' | 'small'
  align?: 'center' | 'left'
  actionRight?: React.ReactNode
  status?: 'valid' | 'invalid'
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSTextInput(
  {
    variant = 'default',
    size = 'default',
    align = 'center',
    actionRight,
    status,
    style,
    value,
    ...props
  }: SSTextInputProps,
  ref: ForwardedRef<TextInput>
) {
  const variantStyle =
    variant === 'default' ? styles.variantDefault : styles.variantOutline
  const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall
  const alignStyle = align === 'center' ? styles.alignCenter : styles.alignLeft
  const actionRightPadding = actionRight ? { paddingRight: 48 } : {}

  // If no explicit status, derive from cache (populated by validateDescriptor calls)
  const cachedValidity =
    status === undefined && value
      ? descriptorValidityCache.get(value)
      : undefined
  const resolvedStatus =
    status ??
    (cachedValidity === true
      ? 'valid'
      : cachedValidity === false
        ? 'invalid'
        : undefined)

  const statusStyle =
    resolvedStatus === 'valid'
      ? styles.statusValid
      : resolvedStatus === 'invalid'
        ? styles.statusInvalid
        : {}

  const textInputStyle = [
    styles.textInputBase,
    variantStyle,
    sizeStyle,
    alignStyle,
    actionRightPadding,
    statusStyle,
    style
  ]

  return (
    <View style={styles.containerBase}>
      <TextInput
        ref={ref}
        placeholderTextColor={Colors.gray[400]}
        autoCorrect={false}
        spellCheck={false}
        value={value}
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
  statusInvalid: {
    borderColor: Colors.error,
    borderWidth: 1
  },
  statusValid: {
    borderColor: Colors.mainGreen,
    borderWidth: 1
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
