import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { TouchableWithoutFeedback, View } from 'react-native'

import SSPopupText from './SSPopupText'

type SSTextClipboardProps = {
  text: string | number
  withPopup?: boolean
  children: React.ReactNode
}

export default function SSTextClipboard({
  text,
  withPopup = true,
  children
}: SSTextClipboardProps) {
  const [showPopup, setShowPopup] = useState(false)
  const handleClick = async () => {
    const textToCopy = typeof text === 'string' ? text : text.toString()
    await Clipboard.setStringAsync(textToCopy)
    setShowPopup(true)
  }

  return (
    <TouchableWithoutFeedback onPress={handleClick}>
      <View>
        {children}
        {withPopup && (
          <SSPopupText
            isVisible={showPopup}
            onTimeout={() => setShowPopup(false)}
            message="Copied to clipboard"
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}
