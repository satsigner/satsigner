import { Stack, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import {
  DESIGN_FEATURE_IDS,
  type DesignFeatureId
} from '@/constants/designSystem'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'

const tn = _tn('settings.developer.designSystem.features')

type FeatureButtonProps = {
  feature: DesignFeatureId
  onOpen: (feature: DesignFeatureId) => void
}

function FeatureButton({ feature, onOpen }: FeatureButtonProps) {
  function handlePress() {
    onOpen(feature)
  }

  return (
    <SSButton
      label={tn(feature)}
      variant="outline"
      withSelect
      onPress={handlePress}
    />
  )
}

export default function DesignFeatures() {
  const router = useRouter()

  function handleOpenFeature(feature: DesignFeatureId) {
    router.navigate({
      params: { feature },
      pathname: '/settings/design/features/[feature]'
    })
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <SSMainLayout>
        <SSScrollView showsVerticalScrollIndicator={false}>
          <SSVStack gap="sm">
            <SSText size="sm" color="muted">
              {tn('description')}
            </SSText>
            {DESIGN_FEATURE_IDS.map((feature) => (
              <FeatureButton
                key={feature}
                feature={feature}
                onOpen={handleOpenFeature}
              />
            ))}
          </SSVStack>
        </SSScrollView>
      </SSMainLayout>
    </>
  )
}
