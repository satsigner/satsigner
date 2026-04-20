import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native'

import { PIN_SIZE } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSKeyboard from './SSKeyboard'
import SSText from './SSText'

type SSPinInputProps = {
  autoFocus?: boolean
  feedBackColor?: string
  feedbackText?: string
  onFillEnded?: (pin: string) => void
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
}

function SSPinInput({
  pin,
  setPin,
  onFillEnded,
  feedbackText,
  feedBackColor = Colors.gray[200]
}: SSPinInputProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (pin.join('') === '') {
      setCurrentIndex(0)
    }
  }, [pin])

<<<<<<< feat-custom-keyboard-pad
  function handleDelete() {
=======
  useEffect(() => {
    if (autoFocus && currentIndex === 0) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus, currentIndex])

  function handleOnChangeText(text: string, index: number) {
    if (text !== '' && !ALLOWED_KEYS.includes(text)) {
      return
    }

>>>>>>> master
    const newPin = [...pin]
    const previousIndex = currentIndex - 1
    if (previousIndex > -1) {
      newPin[previousIndex] = ''
    }
    setCurrentIndex((currentIndex) => currentIndex - 1)
    setPin(newPin)
  }

  function handleClear() {
    setCurrentIndex(0)
    setPin(Array.from({ length: PIN_SIZE }).map((_) => ''))
  }

  function handlePress(digit: string) {
    const newPin = [...pin]
    const lastIndex = PIN_SIZE - 1
    if (currentIndex > lastIndex) {
      return
    }

    newPin[currentIndex] = digit
    setPin(newPin)

    if (currentIndex === lastIndex && onFillEnded) {
      onFillEnded(newPin.join(''))
    }

    setCurrentIndex((currentValue) => currentValue + 1)
  }

  const { height } = useWindowDimensions()

  return (
    <SSVStack itemsCenter gap="none">
      <SSVStack>
        <SSHStack gap="sm">
          {Array.from({ length: PIN_SIZE }).map((_, index) => (
            <TextInput
              key={index}
              style={[
                styles.pinInputBase,
                {
                  borderColor: index === currentIndex ? 'green' : 'black',
                  borderWidth: 1
                }
              ]}
              value={
                pin[index] !== '' ? '•' : index === currentIndex ? '|' : ''
              }
              readOnly
            />
          ))}
        </SSHStack>
        {feedbackText && (
          <SSText uppercase center size="sm" style={{ color: feedBackColor }}>
            {feedbackText}
          </SSText>
        )}
      </SSVStack>
      <View style={{ marginTop: height / 4 }}>
        <SSKeyboard
          onPress={handlePress}
          onClear={handleClear}
          onDelete={handleDelete}
        />
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  pinInputBase: {
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.pinInput.borderRadius,
    color: Colors.white,
    fontSize: Sizes.textInput.fontSize.default,
    height: Sizes.pinInput.height,
    textAlign: 'center',
    width: Sizes.pinInput.width
  }
})

export default SSPinInput
