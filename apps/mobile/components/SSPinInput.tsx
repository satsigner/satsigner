import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState
} from 'react'
import { Keyboard, StyleSheet, TextInput } from 'react-native'

import { PIN_SIZE } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'

type SSPinInputProps = {
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  autoFocus?: boolean
  onFillEnded?: (pin: string) => void
}

const ALLOWED_KEYS: string[] = '0123456789'.split('')

function SSPinInput({
  pin,
  setPin,
  autoFocus = true,
  onFillEnded
}: SSPinInputProps) {
  const inputRefs = useRef<TextInput[]>([])
  const [isBackspace, setIsBackspace] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    function resetFocusOnClear() {
      if (pin.join('') === '') {
        inputRefs.current[0]?.focus()
      }
    }

    resetFocusOnClear()
  }, [pin])

  function handleOnChangeText(text: string, index: number) {
    if (text !== '' && !ALLOWED_KEYS.includes(text)) {
      return
    }

    const newPin = [...pin]
    newPin[index] = text
    setPin(newPin)

    if (text !== '') {
      setCurrentIndex(() => index + 1)
    }

    if (text === '') {
      return
    }

    if (index + 1 < PIN_SIZE) {
      inputRefs.current[index + 1]?.focus()
    }

    if (index === PIN_SIZE - 1) {
      handleLastPin(newPin)
    }
  }

  function handleBackspace(index: number) {
    const newPin = [...pin]
    setIsBackspace(true)
    const previousPinIndex = index - 1
    const currentPinNotEmpty = pin[index] !== ''

    if (currentPinNotEmpty) {
      newPin[index] = ''
      setPin(newPin)
    } else if (previousPinIndex >= 0) {
      newPin[previousPinIndex] = ''
      setPin(newPin)
      inputRefs.current[previousPinIndex]?.focus()
      setCurrentIndex((prev) => prev - 1)
    }
  }

  function handleLastPin(pin: string[]) {
    const finalPin = pin.join('')
    if (finalPin.length !== PIN_SIZE) {
      return
    }
    setIsBackspace(false)
    onFillEnded?.(finalPin)
    Keyboard.dismiss()
  }

  function handleKeyPress(key: string) {
    if (key === 'Backspace') {
      handleBackspace(currentIndex)
    }
  }

  function handleOnFocus() {
    const lastFilledIndex = pin.indexOf('')

    if (lastFilledIndex === 0) {
      inputRefs.current[0]?.focus()
      return
    }

    if (isBackspace) {
      setIsBackspace(false)
      return
    }

    const finalIndex =
      lastFilledIndex === -1 || currentIndex === PIN_SIZE
        ? PIN_SIZE - 1
        : lastFilledIndex

    inputRefs.current[finalIndex]?.focus()
  }

  return (
    <SSHStack gap="sm">
      {Array.from({ length: PIN_SIZE }).map((_, index) => (
        <TextInput
          key={index}
          ref={(input) => {
            if (input) {
              inputRefs.current.push(input)
            }
          }}
          style={styles.pinInputBase}
          autoFocus={autoFocus && index === 0}
          value={pin[index]}
          keyboardType="numeric"
          maxLength={1}
          secureTextEntry
          onChangeText={(text) => handleOnChangeText(text, index)}
          onKeyPress={(event) => handleKeyPress(event.nativeEvent.key)}
          onFocus={() => handleOnFocus()}
        />
      ))}
    </SSHStack>
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
