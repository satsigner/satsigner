import { forwardRef, useEffect, useMemo, useState } from 'react'
import type { ForwardedRef } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSNumberInputProps = {
  variant?: 'default' | 'outline'
  size?: 'default' | 'small'
  align?: 'center' | 'left'
  min: number
  max: number
  onValidate?: (valid: boolean) => void
  showFeedback?: boolean
  allowDecimal?: boolean
  allowValidEmpty?: boolean
  alwaysTriggerOnChange?: boolean
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSNumberInput(
  {
    variant = 'default',
    size = 'default',
    align = 'left',
    min,
    max,
    value,
    onChangeText,
    onValidate,
    showFeedback,
    allowDecimal = false,
    allowValidEmpty = false,
    alwaysTriggerOnChange = false,
    style,
    ...props
  }: SSNumberInputProps,
  ref: ForwardedRef<TextInput>
) {
  const NUMBER_REGEX = allowDecimal ? /^\d*\.?\d{0,8}$/ : /^[0-9]*$/

  const [invalid, setInvalid] = useState(false)

  const textInputStyle = useMemo(() => {
    const variantStyle =
      variant === 'default' ? styles.variantDefault : styles.variantOutline
    const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall
    const alignStyle =
      align === 'center' ? styles.alignCenter : styles.alignLeft
    const borderStyle = invalid ? styles.borderInvalid : {}
    const newStyle = StyleSheet.compose(
      {
        ...styles.textInputBase,
        ...variantStyle,
        ...sizeStyle,
        ...borderStyle,
        ...alignStyle
      },
      style
    )
    return newStyle
  }, [variant, size, align, style, invalid])

  const [localValue, setLocalValue] = useState(value || '')

  useEffect(() => {
    if (value !== localValue) {
      setLocalValue(value || '')
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (value === undefined || value === '') {
      return
    }
    if (!NUMBER_REGEX.test(value)) {
      setInvalid(true)
      if (onValidate) {
        onValidate(false)
      }
      return
    }
    const numericVal = Number(value)
    const invalid = numericVal < min || numericVal > max
    setInvalid(invalid)
    if (onValidate) {
      onValidate(!invalid)
    }
  }, [min, max]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextChange(text: string) {
    if (alwaysTriggerOnChange && onChangeText) {
      onChangeText(text)
    }

    if (!NUMBER_REGEX.test(text)) {
      return
    }

    if (text === '') {
      setLocalValue('')
      setInvalid(!allowValidEmpty)
      if (onValidate) {
        onValidate(false)
      }
      return
    }

    const numericVal = Number(text)
    if (numericVal < min || numericVal > max) {
      setInvalid(true)
      if (onValidate) {
        onValidate(false)
      }
    } else {
      setInvalid(false)
      if (onValidate) {
        onValidate(true)
      }
      if (onChangeText) {
        onChangeText(numericVal.toString())
      }
    }

    setLocalValue(text)
  }

  function handleSubmitText() {
    if (/^[0-9]+$/.test(localValue)) {
      let numericVal = Number(localValue)
      if (numericVal < min) {
        numericVal = min
      }
      if (numericVal > max) {
        numericVal = max
      }
      setInvalid(false)
      if (onValidate) {
        onValidate(true)
      }
      if (onChangeText) {
        onChangeText(numericVal.toString())
      }
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
      {showFeedback && invalid && (
        <SSText>
          {localValue === ''
            ? t('validation.required')
            : !/^[0-9]+$/.test(localValue)
              ? t('validation.invalid')
              : Number(localValue) < min
                ? t('validation.number.greater', { value: min })
                : Number(localValue) > max
                  ? t('validation.number.smaller', { value: max })
                  : t('validation.invalid')}
        </SSText>
      )}
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
  borderInvalid: {
    borderColor: Colors.error,
    borderWidth: 2
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

export default forwardRef(SSNumberInput)
