import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  Keyboard,
  type NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  type TextInputKeyPressEventData
} from 'react-native'
import KeyEvent from 'react-native-keyevent'

import { PIN_SIZE } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import { Colors, Sizes } from '@/styles'

type SSPinInputProps = {
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  autoFocus?: boolean
  onFillEnded?: (pin: string) => void
}

interface KeyEventData {
  keyCode: number
  pressedKey: string
}

const ALLOWED_KEYS: string[] = '0123456789'.split('')
const KEY_CODE_DELETE = 0
const KEY_CODE_BACKSPACE = 67
const KEY_CODE_LEFT = 21

function SSPinInput({ pin, setPin, autoFocus, onFillEnded }: SSPinInputProps) {
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

  useEffect(() => {
    KeyEvent.onKeyUpListener((keyEvent: KeyEventData) => {
      const keyCode = keyEvent.keyCode
      let pressedKey = keyEvent.pressedKey

      if (
        keyCode === KEY_CODE_DELETE ||
        keyCode === KEY_CODE_BACKSPACE ||
        (keyCode === KEY_CODE_LEFT && pin[currentIndex] === '')
      ) {
        pressedKey = 'Backspace'
      }

      // The value of currentIndex has just been updated to the next PIN, which
      // is empty. Therefore, we subtract 1 to get the index of the PIN input
      // which has changed.
      handleKeyPress(pressedKey, currentIndex - 1)
    })

    return () => {
      // Clean up listener on component unmount
      KeyEvent.removeKeyUpListener()
    }
  }, [currentIndex, pin]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleOnChangeText(text: string, index: number) {
    // validate input from physical keyboard
    if (text !== '' && !ALLOWED_KEYS.includes(text)) {
      return
    }

    const newPin = [...pin]
    newPin[index] = text
    setPin(newPin)

    if (text !== '') setCurrentIndex(index + 1)

    if (text === '') return

    if (index + 1 < PIN_SIZE) inputRefs.current[index + 1]?.focus()
  }

  function handleBackspace(index: number) {
    const newPin = [...pin]
    setIsBackspace(true)
    const previousPinIndex = index - 1
    const currentPinNotEmpty = pin[index] !== ''

    if (currentPinNotEmpty) {
      newPin[index] = ''
      setPin(newPin)
      return
    }

    if (previousPinIndex >= 0) {
      newPin[previousPinIndex] = ''
      setPin(newPin)
      inputRefs.current[previousPinIndex]?.focus()
      setCurrentIndex(currentIndex - 1)
    }
  }

  function handleLastPin() {
      setIsBackspace(false)
      onFillEnded?.([...pin].join(''))
      Keyboard.dismiss()
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace') {
      handleBackspace(currentIndex)
    }
    if (index === PIN_SIZE - 1 && ALLOWED_KEYS.includes(key)) {
      handleLastPin()
    }
  }

  function handleOnFocus() {
    const lastFilledIndex = pin.findIndex((text) => text === '')

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
      {[...Array(PIN_SIZE)].map((_, index) => (
        <TextInput
          key={index}
          ref={(input) => inputRefs.current.push(input as TextInput)}
          style={styles.pinInputBase}
          autoFocus={autoFocus && index === 0}
          value={pin[index]}
          keyboardType="numeric"
          maxLength={1}
          secureTextEntry
          onChangeText={(text) => handleOnChangeText(text, index)}
          onKeyPress={(event) => handleKeyPress(event.nativeEvent.key, index)}
          onFocus={() => handleOnFocus()}
        />
      ))}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  pinInputBase: {
    borderRadius: Sizes.pinInput.borderRadius,
    height: Sizes.pinInput.height,
    width: Sizes.pinInput.width,
    textAlign: 'center',
    backgroundColor: Colors.gray[850],
    color: Colors.white,
    fontSize: Sizes.textInput.fontSize.default
  }
})

export default SSPinInput
