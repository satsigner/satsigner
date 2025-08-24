import {
  type ForwardedRef,
  forwardRef,
  useEffect,
  useMemo,
  useState
} from 'react'
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
    if (!value.match(NUMBER_REGEX)) {
      setInvalid(true)
      if (onValidate) onValidate(false)
      return
    }
    const numericVal = Number(value)
    const invalid = numericVal < min || numericVal > max
    setInvalid(invalid)
    if (onValidate) onValidate(!invalid)
  }, [min, max]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTextChange(text: string) {
    if (alwaysTriggerOnChange && onChangeText) onChangeText(text)

    if (!text.match(NUMBER_REGEX)) {
      return
    }

    if (text === '') {
      setLocalValue('')
      setInvalid(!allowValidEmpty)
      if (onValidate) onValidate(false)
      return
    }

    const numericVal = Number(text)
    if (numericVal < min || numericVal > max) {
      setInvalid(true)
      if (onValidate) onValidate(false)
    } else {
      setInvalid(false)
      if (onValidate) onValidate(true)
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
      if (onValidate) onValidate(true)
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
      {showFeedback && invalid && (
        <SSText>
          {localValue === ''
            ? t('validation.required')
            : !localValue.match(/^[0-9]+$/)
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
    textAlign: 'center',
    paddingHorizontal: 12
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

export default forwardRef(SSNumberInput)
