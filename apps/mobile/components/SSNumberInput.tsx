import { useEffect, useState } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance
} from 'react-native'

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
  ref?: React.Ref<TextInputInstance>
} & React.ComponentPropsWithoutRef<typeof TextInput>

function isNumberTextOutOfRange(
  text: string,
  pattern: RegExp,
  min: number,
  max: number
): boolean {
  if (text === '') {
    return false
  }
  if (!pattern.test(text)) {
    return true
  }
  const numericVal = Number(text)
  return numericVal < min || numericVal > max
}

function SSNumberInput({
  variant = 'default',
  size = 'default',
  align = 'left',
  min,
  max,
  value,
  onChangeText,
  onValidate,
  onBlur,
  onEndEditing,
  onFocus,
  showFeedback,
  allowDecimal = false,
  allowValidEmpty = false,
  alwaysTriggerOnChange = false,
  style,
  ref,
  ...props
}: SSNumberInputProps) {
  const NUMBER_REGEX = allowDecimal ? /^\d*\.?\d{0,8}$/ : /^[0-9]*$/

  const [invalid, setInvalid] = useState(false)
  const [focused, setFocused] = useState(false)

  const variantStyle =
    variant === 'default' ? styles.variantDefault : styles.variantOutline
  const sizeStyle = size === 'default' ? styles.sizeDefault : styles.sizeSmall
  const alignStyle = align === 'center' ? styles.alignCenter : styles.alignLeft
  const textInputStyle = [
    styles.textInputBase,
    variantStyle,
    sizeStyle,
    invalid && styles.borderInvalid,
    alignStyle,
    style
  ]

  const [localValue, setLocalValue] = useState(value || '')
  const [syncedFrom, setSyncedFrom] = useState({ focused, value })

  // Showing the parent's value again (on blur, or when it changes from
  // outside) also re-judges it: the error belonged to the text it replaced.
  if (syncedFrom.focused !== focused || syncedFrom.value !== value) {
    setSyncedFrom({ focused, value })
    if (!focused && value !== localValue) {
      setLocalValue(value || '')
      setInvalid(isNumberTextOutOfRange(value || '', NUMBER_REGEX, min, max))
    }
  }

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
    const nextInvalid = numericVal < min || numericVal > max
    setInvalid(nextInvalid)
    if (onValidate) {
      onValidate(!nextInvalid)
    }
  }, [min, max]) // eslint-disable-line react-hooks/exhaustive-deps

  function emitChange(text: string, numericVal: number | null) {
    if (!onChangeText) {
      return
    }
    if (alwaysTriggerOnChange) {
      onChangeText(text)
      return
    }
    if (numericVal === null) {
      return
    }
    if (numericVal >= min && numericVal <= max) {
      onChangeText(numericVal.toString())
    }
  }

  function handleTextChange(text: string) {
    if (!NUMBER_REGEX.test(text)) {
      return
    }

    setLocalValue(text)

    if (text === '') {
      setInvalid(!allowValidEmpty)
      if (onValidate) {
        onValidate(allowValidEmpty)
      }
      if (allowValidEmpty && onChangeText) {
        onChangeText('')
      } else {
        emitChange('', null)
      }
      return
    }

    const numericVal = Number(text)
    const outOfRange = numericVal < min || numericVal > max
    setInvalid(outOfRange)
    if (onValidate) {
      onValidate(!outOfRange)
    }
    emitChange(text, numericVal)
  }

  // Blurring shows the parent's value again (see above), so the parent must
  // hear the verdict on that value, not on the text it replaces.
  function revalidateParentValue() {
    const parentText = value || ''
    if (!onValidate || parentText === localValue) {
      return
    }
    onValidate(!isNumberTextOutOfRange(parentText, NUMBER_REGEX, min, max))
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
      setLocalValue(numericVal.toString())
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
        onFocus={(event) => {
          setFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setFocused(false)
          revalidateParentValue()
          onBlur?.(event)
        }}
        onEndEditing={onEndEditing}
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

export default SSNumberInput
