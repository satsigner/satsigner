import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { SSIconArrowsClockwise } from '@/components/icons'
import SSDesignFeaturePreview from '@/components/SSDesignFeaturePreview'
import SSHeaderSettingsButton from '@/components/SSHeaderSettingsButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { DESIGN_FEATURE_SET_NAMES } from '@/constants/designSampleVariations'
import { isDesignFeatureId } from '@/constants/designSystem'
import {
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE,
  HEADER_ICON_STROKE
} from '@/constants/headerChrome'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'

type RefreshHeaderProps = {
  onRefresh: () => void
}

function RefreshHeader({ onRefresh }: RefreshHeaderProps) {
  return (
    <SSHStack gap="none">
      <SSIconButton
        accessibilityLabel={t(
          'settings.developer.designSystem.features.refreshData'
        )}
        style={HEADER_CHROME_HIT_BOX}
        onPress={onRefresh}
      >
        <SSIconArrowsClockwise
          height={HEADER_CHROME_SETTINGS_ICON_SIZE}
          stroke={HEADER_ICON_STROKE}
          width={HEADER_CHROME_SETTINGS_ICON_SIZE}
        />
      </SSIconButton>
      <SSHeaderSettingsButton />
    </SSHStack>
  )
}

export default function DesignFeature() {
  const { feature } = useLocalSearchParams<{ feature: string }>()
  const [setIndex, setSetIndex] = useState(0)

  if (!isDesignFeatureId(feature)) {
    return <Redirect href="/settings/design/features" />
  }

  const setCount = DESIGN_FEATURE_SET_NAMES[feature]?.length ?? 0

  function handleRefresh() {
    setSetIndex((current) => (current + 1) % setCount)
  }

  return (
    <>
      <Stack.Screen
        options={{
          ...(setCount > 1 && {
            headerRight: () => <RefreshHeader onRefresh={handleRefresh} />
          }),
          headerTitle: () => (
            <SSText uppercase>
              {t(`settings.developer.designSystem.features.${feature}`)}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSDesignFeaturePreview
          key={setIndex}
          feature={feature}
          setIndex={setIndex}
        />
      </SSMainLayout>
    </>
  )
}
