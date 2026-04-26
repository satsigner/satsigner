import { Slot, Stack, usePathname, useRouter } from 'expo-router'
import { Platform } from 'react-native'

import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'

const HEADER_ICON_STROKE = '#828282'

export default function ArkSendLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const isSendIndex = /\/signer\/ark\/account\/[^/]+\/send\/?$/.test(pathname)

  return (
    <>
      {isSendIndex ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <SSIconButton
                style={
                  Platform.OS === 'android' && [
                    HEADER_CHROME_HIT_BOX,
                    { marginRight: -HEADER_CHROME_EDGE_NUDGE }
                  ]
                }
                onPress={() => router.navigate('/settings')}
              >
                <SSIconSettings
                  height={HEADER_CHROME_SETTINGS_ICON_SIZE}
                  stroke={HEADER_ICON_STROKE}
                  width={HEADER_CHROME_SETTINGS_ICON_SIZE}
                />
              </SSIconButton>
            )
          }}
        />
      ) : null}
      <Slot />
    </>
  )
}
