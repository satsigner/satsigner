import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import {
  SSIconAbout,
  SSIconDev,
  SSIconFeature,
  SSIconLock,
  SSIconNetwork
} from '@/components/icons'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function Settings() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText size="xl">{t('settings.title')}</SSText>,
          headerRight: undefined
        }}
      />
      <ScrollView>
        <SSVStack gap="none">
          <SSSettingsCards
            title={t('settings.network.title')}
            description={t('settings.network.description')}
            icon={<SSIconNetwork height={24} width={24} />}
            onPress={() => router.navigate('/settings/network')}
          />
          <SSSettingsCards
            title={t('settings.features.title')}
            description={t('settings.features.description')}
            icon={<SSIconFeature height={24} width={24} />}
            onPress={() => router.navigate('/settings/features')}
          />
          <SSSettingsCards
            title={t('settings.security.title')}
            description={t('settings.security.description')}
            icon={<SSIconLock height={32} width={24} />}
            onPress={() => router.navigate('/settings/security')}
          />
          <SSSettingsCards
            title={t('settings.about.title')}
            description={t('settings.about.description')}
            icon={<SSIconAbout height={26} width={26} />}
            onPress={() => router.navigate('/settings/about')}
          />
          {__DEV__ && (
            <SSSettingsCards
              title={t('settings.developer.title')}
              description={t('settings.developer.description')}
              icon={<SSIconDev height={24} width={24} />}
              onPress={() => router.navigate('/settings/developer')}
            />
          )}
        </SSVStack>
      </ScrollView>
    </>
  )
}
