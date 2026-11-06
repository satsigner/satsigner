import { Slot, Stack, usePathname, useRouter } from 'expo-router'
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

export default function ArkSendLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const isSendIndex = ARK_SEND_INDEX_PATH.test(pathname)
  const title = isSendIndex ? t('ark.send.title') : t('ark.send.confirmTitle')

  function openSettings() {
    router.navigate('/settings')
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: isSendIndex
            ? () => (
                <SSIconButton
                  style={
                    Platform.OS === 'android' && [
                      HEADER_CHROME_HIT_BOX,
                      { marginRight: -HEADER_CHROME_EDGE_NUDGE }
                    ]
                  }
                  onPress={openSettings}
                >
                  <SSIconSettings
                    height={HEADER_CHROME_SETTINGS_ICON_SIZE}
                    stroke={HEADER_ICON_STROKE}
                    width={HEADER_CHROME_SETTINGS_ICON_SIZE}
                  />
                </SSIconButton>
              )
            : undefined,
          headerTitle: () => <SSText uppercase>{title}</SSText>
        }}
      />
      <Slot />
    </>
  )
}
