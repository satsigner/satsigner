import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import {
  SSIconMempool,
  SSIconServer,
  SSIconServerOptions
} from '@/components/icons'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'

const tn = _tn('settings.network')

export default function Features() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>,
          headerRight: undefined
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSVStack>
              <SSSettingsCards
                title={tn('server.title')}
                description={tn('server.description')}
                icon={<SSIconServer width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/network/server')
                }}
              />
              <SSSettingsCards
                title={tn('explorer.title')}
                description={tn('explorer.description')}
                icon={<SSIconMempool width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/network/explorer')
                }}
              />
              <SSSettingsCards
                title={tn('config.title')}
                description={tn('config.description')}
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
