import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconHistoryChart } from '@/components/icons'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

export default function Features() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Network</SSText>,
          headerBackVisible: true,
          headerLeft: () => <></>,
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
                icon={
                  <SSIconHistoryChart
                    width={24}
                    height={24}
                    stroke={Colors.white}
                  />
                }
                onPress={() => {
                  router.navigate('/settings/network/server')
                }}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </>
  )
}
