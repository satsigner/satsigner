import { Stack } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import {
  autoSelectUtxosDescriptionKey,
  autoSelectUtxosTitleKey
} from '@/utils/autoSelectUtxos'

const tl = tn('settings.features.autoSelectUtxos')

const AUTO_SELECT_OPTIONS: AutoSelectUtxosAlgorithm[] = [
  'privacy',
  'efficiency',
  'user'
]

export default function AutoSelectUtxos() {
  const [defaultAutoSelectUtxos, setDefaultAutoSelectUtxos] = useSettingsStore(
    useShallow((state) => [
      state.defaultAutoSelectUtxos,
      state.setDefaultAutoSelectUtxos
    ])
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => <SSText uppercase>{tl('title')}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack gap="lg">
          <SSText>{tl('longDescription')}</SSText>
          <SSVStack gap="xs">
            {AUTO_SELECT_OPTIONS.map((algorithm) => (
              <SSRadioButton
                key={algorithm}
                variant="outline"
                label={t(autoSelectUtxosTitleKey(algorithm))}
                selected={defaultAutoSelectUtxos === algorithm}
                onPress={() => setDefaultAutoSelectUtxos(algorithm)}
              />
            ))}
          </SSVStack>
          <SSText color="muted">
            {t(autoSelectUtxosDescriptionKey(defaultAutoSelectUtxos))}
          </SSText>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
