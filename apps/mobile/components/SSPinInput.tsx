import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'

import { PIN_SIZE } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors, Sizes } from '@/styles'

import SSKeyboard from './SSKeyboard'

type SSPinInputProps = {
  pin: string[]
  setPin: Dispatch<SetStateAction<string[]>>
  autoFocus?: boolean
  onFillEnded?: (pin: string) => void
}

function SSPinInput({ pin, setPin, onFillEnded }: SSPinInputProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (pin.join('') === '') {
      setCurrentIndex(0)
    }
  }, [pin])

  function handleDelete() {
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

  return (
    <SSVStack itemsCenter>
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
            value={pin[index] !== '' ? '*' : index === currentIndex ? '|' : ''}
            readOnly
          />
        ))}
      </SSHStack>
      <SSKeyboard
        onPress={handlePress}
        onClear={handleClear}
        onDelete={handleDelete}
      />
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
