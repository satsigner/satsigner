import { ForwardedRef, forwardRef, useEffect, useMemo, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSTextInputProps = {
  variant?: 'default' | 'outline'
  size?: 'default' | 'small'
  align?: 'center' | 'left'
  min: number
  max: number
  actionRight?: React.ReactNode
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSTextInput(
  {
    variant = 'default',
    size = 'default',
    align = 'left',
    actionRight,
    style,
    value,
    onChangeText,
    min,
    max,
    ...props
  }: SSTextInputProps,
  ref: ForwardedRef<TextInput>
) {
  const [invalid, setInvalid] = useState(false)

  const textInputStyle = useMemo(() => {
    const variantStyle =
      variant === 'default' ? styles.variantDefault : styles.variantOutline
    const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall
    const alignStyle =
      align === 'center' ? styles.alignCenter : styles.alignLeft
    const borderStyle = invalid ? styles.borderInvalid : {}
    return StyleSheet.compose(
      {
        ...styles.textInputBase,
        ...variantStyle,
        ...sizeStyle,
        ...alignStyle,
        ...borderStyle
      },
      style
    )
  }, [variant, size, align, style, invalid])

  const [localValue, setLocalValue] = useState(value || '')

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || '')
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextChange(text: string) {
    if (!text.match(/^[0-9]*$/)) {
      return
    }

    if (text === '') {
      setLocalValue('')
      setInvalid(true)
      return
    }

    const numericVal = Number(text)
    if (numericVal < min || numericVal > max) {
      setInvalid(true)
    } else {
      setInvalid(false)
      if (onChangeText) onChangeText(numericVal.toString())
    }

    setLocalValue(text)
  }

  function handleSubmitText() {
    if (localValue.match(/^[0-9]+$/)) {
      let numericVal = Number(localValue)
      if (numericVal < min) numericVal = min
      if (numericVal > max) numericVal = max
      setInvalid(false)
      if (onChangeText) onChangeText(numericVal.toString())
    }
  }

  return (
    <View style={styles.containerBase}>
      <TextInput
        ref={ref}
        value={localValue}
        onChangeText={handleTextChange}
        onSubmitEditing={handleSubmitText}
        keyboardType="numeric"
        placeholderTextColor={Colors.gray[400]}
        style={textInputStyle}
        {...props}
      />
      <View style={styles.actionRightBase}>{actionRight}</View>
    </View>
  )
}

export default forwardRef(SSTextInput)

const styles = StyleSheet.create({
  containerBase: {
    position: 'relative',
    width: '100%'
  },
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
  },
  actionRightBase: {
    position: 'absolute',
    top: '50%',
    right: 12,
    transform: [{ translateY: -12 }]
  },
  borderInvalid: {
    borderWidth: 2,
    borderColor: Colors.error
  }
})
