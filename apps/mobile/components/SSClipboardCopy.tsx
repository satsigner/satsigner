import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { TouchableWithoutFeedback, View, type ViewStyle } from 'react-native'

import { t } from '@/locales'

import SSPopupText from './SSPopupText'

type SSTextClipboardProps = {
  text: string | number
  withPopup?: boolean
  children: React.ReactNode
  style?: ViewStyle
}

function SSClipboardCopy({
  text,
  withPopup = true,
  children,
  style
}: SSTextClipboardProps) {
  const [showPopup, setShowPopup] = useState(false)

  async function handleClick() {
    const textToCopy = typeof text === 'string' ? text : text.toString()
    await Clipboard.setStringAsync(textToCopy)
    setShowPopup(true)
  }

  return (
    <TouchableWithoutFeedback onPress={handleClick}>
      <View style={[{ width: '100%' }, style]}>
        <View style={{ pointerEvents: 'none' }}>{children}</View>
        {withPopup && (
          <SSPopupText
            isVisible={showPopup}
            onTimeout={() => setShowPopup(false)}
            message={t('common.copiedToClipboard')}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default SSClipboardCopy
