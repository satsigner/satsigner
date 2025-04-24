import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconServer, SSIconServerOptions } from '@/components/icons'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function Features() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Network</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSSettingsCards
                title={t('settings.network.server.title')}
                description={t('settings.network.server.description')}
                icon={<SSIconServer width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/network/server')
                }}
              />
              <SSSettingsCards
                title={t('settings.network.config.title')}
                description={t('settings.network.config.description')}
                icon={<SSIconServerOptions width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/network/params')
                }}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </>
  )
}
