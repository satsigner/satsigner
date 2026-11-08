import { Stack, useRouter } from 'expo-router'

import {
  SSIconBubbles,
  SSIconChartSettings,
  SSIconDev,
  SSIconHistoryChart,
  SSIconLightning,
  SSIconList,
  SSIconLock,
  SSIconMultiSignature,
  SSIconScriptsP2pkh,
  SSIconSearch,
  SSIconSeed,
  SSIconTransaction
} from '@/components/icons'
import SSDevOnlyRoute from '@/components/SSDevOnlyRoute'
import SSSettingsCard from '@/components/SSSettingsCard'
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

const CARD_ICON_SIZE = 24

const FEATURE_ICONS = {
  autocomplete: SSIconSearch,
  decoded: SSIconScriptsP2pkh,
  devConsole: SSIconDev,
  historyChart: SSIconHistoryChart,
  lightningNode: SSIconLightning,
  multisigSelector: SSIconMultiSignature,
  pinInput: SSIconLock,
  sankey: SSIconTransaction,
  seedWordInput: SSIconSeed,
  transactionCard: SSIconList,
  transactionChart: SSIconChartSettings,
  utxoChart: SSIconBubbles
} satisfies Record<DesignFeatureId, unknown>

type FeatureCardProps = {
  feature: DesignFeatureId
  onOpen: (feature: DesignFeatureId) => void
}

function FeatureCard({ feature, onOpen }: FeatureCardProps) {
  const Icon = FEATURE_ICONS[feature]

  function handlePress() {
    onOpen(feature)
  }

  return (
    <SSSettingsCard
      title={tn(feature)}
      description={tn(`${feature}Description`)}
      icon={<Icon width={CARD_ICON_SIZE} height={CARD_ICON_SIZE} />}
      onPress={handlePress}
    />
  )
}

function DesignFeaturesScreen() {
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
          <SSVStack gap="none">
            {DESIGN_FEATURE_IDS.map((feature) => (
              <FeatureCard
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

export default function DesignFeatures() {
  return (
    <SSDevOnlyRoute>
      <DesignFeaturesScreen />
    </SSDevOnlyRoute>
  )
}
