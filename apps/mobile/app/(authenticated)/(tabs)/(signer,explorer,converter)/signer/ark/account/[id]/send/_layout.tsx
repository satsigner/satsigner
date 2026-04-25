import { Slot, Stack, usePathname, useRouter } from 'expo-router'
import { Platform } from 'react-native'

import { SSIconOffboardCircle, SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import SSHStack from '@/layouts/SSHStack'

const HEADER_ICON_STROKE = '#828282'

export default function ArkSendLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const match = pathname.match(/\/signer\/ark\/account\/([^/]+)\/send\/?$/)
  const isSendIndex = match !== null
  const accountId = match?.[1]

  return (
    <>
      {isSendIndex && accountId ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <SSHStack gap="none">
                <SSIconButton
                  onPress={() =>
                    router.navigate({
                      params: { id: accountId },
                      pathname: '/signer/ark/account/[id]/send/offboard'
                    })
                  }
                >
                  <SSIconOffboardCircle
                    height={HEADER_CHROME_SETTINGS_ICON_SIZE}
                    stroke={HEADER_ICON_STROKE}
                    width={HEADER_CHROME_SETTINGS_ICON_SIZE}
                  />
                </SSIconButton>
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
              </SSHStack>
            )
          }}
        />
      ) : null}
      <Slot />
    </>
  )
}
