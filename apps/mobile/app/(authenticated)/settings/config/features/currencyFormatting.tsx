import { Stack } from 'expo-router'

import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import SSCheckbox from '@/components/SSCheckbox'
import { useAccountsStore } from '@/store/accounts'
import { useShallow } from 'zustand/react/shallow'
import { useCallback } from 'react'

export default function CurrencyFormatting() {
  const [setPadding, padding] = useAccountsStore(
    useShallow((state) => [state.setPadding, state.padding])
  )

  const togglePadding = useCallback(
    () => setPadding(!padding),
    [setPadding, padding]
  )
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {i18n.t('settings.features.featurePage.currencyFormatting.title')}
            </SSText>
          ),
          headerBackVisible: true,
          headerLeft: () => <></>,
          headerRight: undefined
        }}
      />
      <SSMainLayout>
        <SSVStack>
          <SSCheckbox
            label="SHOW '0.00..' PADDING"
            selected={padding}
            onPress={togglePadding}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
