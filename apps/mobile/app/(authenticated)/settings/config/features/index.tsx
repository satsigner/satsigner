import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconChartWhite, SSIconZero } from '@/components/icons'
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
          headerTitle: () => (
            <SSText uppercase>{t('settings.features.title')}</SSText>
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
                title={t('settings.features.charts.historyChart.title')}
                description={t(
                  'settings.features.charts.historyChart.description'
                )}
                icon={<SSIconChartWhite width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/config/features/chartSettings')
                }}
              />
              <SSSettingsCards
                title={t('settings.features.currencyFormatting.title')}
                description={t(
                  'settings.features.currencyFormatting.description'
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
