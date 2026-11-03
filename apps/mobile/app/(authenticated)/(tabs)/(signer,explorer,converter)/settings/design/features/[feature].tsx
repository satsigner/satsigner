import { Redirect, Stack, useLocalSearchParams } from 'expo-router'

import SSDesignFeaturePreview from '@/components/SSDesignFeaturePreview'
import SSText from '@/components/SSText'
import { isDesignFeatureId } from '@/constants/designSystem'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'

export default function DesignFeature() {
  const { feature } = useLocalSearchParams<{ feature: string }>()

  if (!isDesignFeatureId(feature)) {
    return <Redirect href="/settings/design/features" />
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t(`settings.developer.designSystem.features.${feature}`)}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSDesignFeaturePreview feature={feature} />
      </SSMainLayout>
    </>
  )
}
