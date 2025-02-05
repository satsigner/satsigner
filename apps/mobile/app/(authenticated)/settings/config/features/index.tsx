import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconChartWhite, SSIconZero } from '@/components/icons'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'

export default function Features() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {i18n.t('settings.features.featurePage.title')}
            </SSText>
          ),
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
                title={i18n.t(
                  'settings.features.featurePage.transactionChart.title'
                )}
                description={i18n.t(
                  'settings.features.featurePage.transactionChart.description'
                )}
                icon={<SSIconChartWhite width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/config/features/chartSettings')
                }}
              />
              <SSSettingsCards
                title={i18n.t(
                  'settings.features.featurePage.currencyFormatting.title'
                )}
                description={i18n.t(
                  'settings.features.featurePage.currencyFormatting.description'
                )}
                icon={<SSIconZero width={24} height={24} />}
                onPress={() => {
                  router.navigate(
                    '/settings/config/features/currencyFormatting'
                  )
                }}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </>
  )
}
