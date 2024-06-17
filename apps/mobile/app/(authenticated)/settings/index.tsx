import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import SSIconButton from '@/components/SSIconButton'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'

export default function Settings() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerBackground: () => null,
          headerBackVisible: false,
          headerTitle: '',
          headerLeft: () => <SSText size="xl">Config</SSText>,
          headerRight: () => (
            <SSIconButton onPress={() => router.back()}>
              <Image
                style={{ width: 18, height: 18 }}
                source={require('@/assets/icons/home.svg')}
              />
            </SSIconButton>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="none">
          <SSSettingsCards
            title={i18n.t('settings.bitcoinNetwork.title')}
            description={i18n.t('settings.bitcoinNetwork.description')}
            icon={
              <Image
                style={{ width: 24, height: 24 }}
                source={require('@/assets/icons/network.svg')}
              />
            }
            onPress={() => router.navigate('/settings/config/bitcoinNetwork')}
          />
          <SSSettingsCards
            title={i18n.t('settings.appSecurity.title')}
            description={i18n.t('settings.appSecurity.description')}
            icon={
              <Image
                style={{ width: 24, height: 32 }}
                source={require('@/assets/icons/lock.svg')}
              />
            }
            onPress={() => router.navigate('/settings/config/appSecurity')}
          />
          {__DEV__ && (
            <SSSettingsCards
              title={i18n.t('settings.developer.title')}
              description={i18n.t('settings.developer.description')}
              icon={
                <Image
                  style={{ width: 24, height: 24 }}
                  source={require('@/assets/icons/dev.svg')}
                />
              }
              onPress={() => router.navigate('/settings/config/developer')}
            />
          )}
        </SSVStack>
      </ScrollView>
    </>
  )
}
