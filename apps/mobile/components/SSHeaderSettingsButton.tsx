import { useRouter } from 'expo-router'
import { Platform } from 'react-native'

import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE,
  HEADER_ICON_STROKE
} from '@/constants/headerChrome'

const ANDROID_STYLE = [
  HEADER_CHROME_HIT_BOX,
  { marginRight: -HEADER_CHROME_EDGE_NUDGE }
]

function SSHeaderSettingsButton() {
  const router = useRouter()

  function handlePress() {
    router.navigate('/settings')
  }

  return (
    <SSIconButton
      style={Platform.OS === 'android' && ANDROID_STYLE}
      onPress={handlePress}
    >
      <SSIconSettings
        height={HEADER_CHROME_SETTINGS_ICON_SIZE}
        stroke={HEADER_ICON_STROKE}
        width={HEADER_CHROME_SETTINGS_ICON_SIZE}
      />
    </SSIconButton>
  )
}

export default SSHeaderSettingsButton
