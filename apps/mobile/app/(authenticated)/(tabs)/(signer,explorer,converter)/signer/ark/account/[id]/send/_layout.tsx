import { router, Slot, Stack, usePathname } from 'expo-router'
import { Platform } from 'react-native'

import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import { t } from '@/locales'

const HEADER_ICON_STROKE = '#828282'
const ARK_SEND_INDEX_PATH = /\/signer\/ark\/account\/[^/]+\/send\/?$/
const SETTINGS_BUTTON_STYLE = Platform.OS === 'android' && [
  HEADER_CHROME_HIT_BOX,
  { marginRight: -HEADER_CHROME_EDGE_NUDGE }
]

function openSettings() {
  router.navigate('/settings')
}

function ArkSendSettingsButton() {
  return (
    <SSIconButton style={SETTINGS_BUTTON_STYLE} onPress={openSettings}>
      <SSIconSettings
        height={HEADER_CHROME_SETTINGS_ICON_SIZE}
        stroke={HEADER_ICON_STROKE}
        width={HEADER_CHROME_SETTINGS_ICON_SIZE}
      />
    </SSIconButton>
  )
}

function ArkSendTitle() {
  return <SSText uppercase>{t('ark.send.title')}</SSText>
}

function ArkSendConfirmTitle() {
  return <SSText uppercase>{t('ark.send.confirmTitle')}</SSText>
}

const SEND_SCREEN_OPTIONS = {
  headerRight: ArkSendSettingsButton,
  headerTitle: ArkSendTitle
}

const CONFIRM_SCREEN_OPTIONS = {
  headerRight: undefined,
  headerTitle: ArkSendConfirmTitle
}

export default function ArkSendLayout() {
  const pathname = usePathname()
  const options = ARK_SEND_INDEX_PATH.test(pathname)
    ? SEND_SCREEN_OPTIONS
    : CONFIRM_SCREEN_OPTIONS

  return (
    <>
      <Stack.Screen options={options} />
      <Slot />
    </>
  )
}
