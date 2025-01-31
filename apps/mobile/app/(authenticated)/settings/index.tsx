import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import {
  SSIconAbout,
  SSIconDev,
  SSIconFeatures,
  SSIconLock,
  SSIconNetwork
} from '@/components/icons'
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
          headerTitle: () => (
            <SSText size="xl">{i18n.t('settings.title')}</SSText>
          ),
          headerRight: undefined
        }}
      />
      <ScrollView>
        <SSVStack gap="none">
          <SSSettingsCards
            title={i18n.t('settings.bitcoinNetwork.title')}
            description={i18n.t('settings.bitcoinNetwork.description')}
            icon={<SSIconNetwork height={24} width={24} />}
            onPress={() => router.navigate('/settings/config/bitcoinNetwork')}
          />
          <SSSettingsCards
            title={i18n.t('settings.features.title')}
            description={i18n.t('settings.features.description')}
            icon={<SSIconFeatures height={24} width={24} />}
            onPress={() => router.navigate('/settings/config/features')}
          />
          <SSSettingsCards
            title={i18n.t('settings.appSecurity.title')}
            description={i18n.t('settings.appSecurity.description')}
            icon={<SSIconLock height={32} width={24} />}
            onPress={() => router.navigate('/settings/config/appSecurity')}
          />
          <SSSettingsCards
            title={i18n.t('settings.about.title')}
            description={i18n.t('settings.about.description')}
            icon={<SSIconAbout height={26} width={26} />}
            onPress={() => router.navigate('/settings/config/about')}
          />
          {__DEV__ && (
            <SSSettingsCards
              title={i18n.t('settings.developer.title')}
              description={i18n.t('settings.developer.description')}
              icon={<SSIconDev height={24} width={24} />}
              onPress={() => router.navigate('/settings/config/developer')}
            />
          )}
        </SSVStack>
      </ScrollView>
    </>
  )
}
