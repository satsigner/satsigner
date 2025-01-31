import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconCurrencyFormatting } from '@/components/icons'
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
            <SSText uppercase>{i18n.t('settings.features.title')}</SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <ScrollView>
        <SSVStack gap="none">
          <SSSettingsCards
            title={i18n.t('settings.features.currencyFormatting.title')}
            description={i18n.t(
              'settings.features.currencyFormatting.description'
            )}
            icon={<SSIconCurrencyFormatting height={11} width={29} />}
            onPress={() =>
              router.navigate(
                '/settings/config/features/config/currencyFormatting'
              )
            }
          />
        </SSVStack>
      </ScrollView>
    </>
  )
}
