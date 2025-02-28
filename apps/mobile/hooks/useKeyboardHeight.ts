import { useEffect, useState } from 'react'
import { Keyboard, type KeyboardEvent } from 'react-native'

export default function useKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    function onKeyboardDidShow(e: KeyboardEvent) {
      setKeyboardHeight(e.endCoordinates.height)
    }

    function onKeyboardDidHide() {
      setKeyboardHeight(0)
    }

    const onShow = Keyboard.addListener('keyboardDidShow', onKeyboardDidShow)
    const onHide = Keyboard.addListener('keyboardDidHide', onKeyboardDidHide)

    return () => {
      onShow.remove()
      onHide.remove()
    }
  }, [])

  return keyboardHeight
}
