import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useRef,
  useState
} from 'react'
import { Keyboard, StyleSheet, TextInput } from 'react-native'
import KeyEvent, { type KeyEventProps } from 'react-native-keyevent'

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
const KEY_CODE_DELETE = 0
const KEY_CODE_BACKSPACE = 67
const KEY_CODE_LEFT = 21
const DELETE_DELAY = 50 // delay in miliseconds between consecutive deletions

function SSPinInput({ pin, setPin, autoFocus, onFillEnded }: SSPinInputProps) {
  const inputRefs = useRef<TextInput[]>([])
  const [isBackspace, setIsBackspace] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasJustDeletedChar, setHasJustDeletedChar] = useState(false)

  useEffect(() => {
    function resetFocusOnClear() {
      if (pin.join('') === '') {
        inputRefs.current[0]?.focus()
      }
    }

    resetFocusOnClear()
  }, [pin])

  useEffect(() => {
    KeyEvent.onKeyUpListener((keyEvent: KeyEventProps) => {
      // key code is from ASCII TABLE
      const keyCode = keyEvent.keyCode
      let pressedKey = keyEvent.pressedKey

      if (
        keyCode === KEY_CODE_DELETE ||
        keyCode === KEY_CODE_BACKSPACE ||
        (keyCode === KEY_CODE_LEFT && pin[currentIndex] === '')
      ) {
        pressedKey = 'Backspace'
      }

      handleKeyPress(pressedKey)
    })

    return () => {
      // Clean up listener on component unmount
      KeyEvent.removeKeyUpListener()
    }
  }, [currentIndex, pin, hasJustDeletedChar]) // eslint-disable-line react-hooks/exhaustive-deps

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

    if (index === PIN_SIZE - 1) handleLastPin(newPin)
  }

  function handleBackspace(index: number) {
    if (hasJustDeletedChar) return
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
      setCurrentIndex(currentIndex - 1)
    }

    // INFO: we have two keystroke  event  listeners.  React  Native  onKeyPress
    // handler does NOT work with physical keyboards while onKeyUpListener  from
    // react-native-keyevent does work with both virtual and physical keyboards.
    // However, onKeyUpListener does NOT detect the BACKSPACE from  the  virtual
    // keyboard on emulator (it does detect other keys), thus we need to  listen
    // to events from both React Native  and  the  keyevent  library.  But  this
    // introduces a  bug:  BACKSPACE  is  triggered  twice  when  using  virtual
    // keyboard on physical devices (virtual keyboard on emulator  works  fine).
    // Thus, we need to add a  delay  to  prevent  BACKSPACE  getting  triggered
    // multiple times in a row.
    setHasJustDeletedChar(true)
    setTimeout(() => {
      setHasJustDeletedChar(false)
    }, DELETE_DELAY)
  }

  function handleLastPin(pin: string[]) {
    const finalPin = pin.join('')
    if (finalPin.length !== PIN_SIZE) return
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
          onKeyPress={(event) => handleKeyPress(event.nativeEvent.key)}
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
