import { Stack, useRouter } from 'expo-router'

import {
  SSIconEditPencil,
  SSIconFeature,
  SSIconHistoryChart,
  SSIconTable
} from '@/components/icons'
import SSSettingsCard from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

const CARD_ICON_SIZE = 24

export default function DesignIndex() {
  const router = useRouter()

  function handleOpenTypography() {
    router.navigate('/settings/design/typography')
  }

  function handleOpenIcons() {
    router.navigate('/settings/design/icons')
  }

  function handleOpenComponents() {
    router.navigate('/settings/design/components')
  }

  function handleOpenFeatures() {
    router.navigate('/settings/design/features')
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.design')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSScrollView showsVerticalScrollIndicator={false}>
          <SSVStack gap="none">
            <SSSettingsCard
              title={t('settings.developer.designSystem.typography.title')}
              description={t(
                'settings.developer.designSystem.typography.description'
              )}
              icon={
                <SSIconEditPencil
                  width={CARD_ICON_SIZE}
                  height={CARD_ICON_SIZE}
                />
              }
              onPress={handleOpenTypography}
            />
            <SSSettingsCard
              title={t('settings.developer.icons')}
              description={t(
                'settings.developer.designSystem.icons.description'
              )}
              icon={
                <SSIconFeature width={CARD_ICON_SIZE} height={CARD_ICON_SIZE} />
              }
              onPress={handleOpenIcons}
            />
            <SSSettingsCard
              title={t('settings.developer.designSystem.components.title')}
              description={t(
                'settings.developer.designSystem.components.description'
              )}
              icon={
                <SSIconTable width={CARD_ICON_SIZE} height={CARD_ICON_SIZE} />
              }
              onPress={handleOpenComponents}
            />
            <SSSettingsCard
              title={t('settings.developer.designSystem.features.title')}
              description={t(
                'settings.developer.designSystem.features.description'
              )}
              icon={
                <SSIconHistoryChart
                  width={CARD_ICON_SIZE}
                  height={CARD_ICON_SIZE}
                />
              }
              onPress={handleOpenFeatures}
            />
          </SSVStack>
        </SSScrollView>
      </SSMainLayout>
    </>
  )
}
