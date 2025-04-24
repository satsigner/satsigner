import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'

import { SSIconHistoryChart, SSIconZero } from '@/components/icons'
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
          headerTitle: () => (
            <SSText uppercase>{t('settings.features.title')}</SSText>
          ),
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
                icon={
                  <SSIconHistoryChart
                    width={24}
                    height={24}
                    stroke={Colors.white}
                  />
                }
                onPress={() => {
                  router.navigate('/settings/features/historyChart')
                }}
              />
              <SSSettingsCards
                title={t('settings.features.currencyFormatting.title')}
                description={t(
                  'settings.features.currencyFormatting.description'
                )}
                icon={<SSIconZero width={24} height={24} />}
                onPress={() => {
                  router.navigate('/settings/features/currencyFormatting')
                }}
              />
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSVStack>
    </>
  )
}
