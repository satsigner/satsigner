import { Stack } from 'expo-router'
import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'

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
