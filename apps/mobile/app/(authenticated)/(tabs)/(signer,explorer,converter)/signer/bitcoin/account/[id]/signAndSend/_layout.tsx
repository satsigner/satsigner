import { Slot, Stack, useLocalSearchParams, useSegments } from 'expo-router'
import { useFocusEffect } from 'expo-router/react-navigation'

import { SSIconEyeOn } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

// The children render inside this layout's Slot, so their own Stack.Screen
// options never reach the header: the layout picks the title for them.
const SCREEN_TITLE_KEYS = new Map([
  ['excludeUtxos', 'utxo.exclude.title'],
  ['feeManagement', 'transaction.build.options.extraOptions'],
  ['importOutputs', 'transaction.build.options.extraSecurity'],
  ['timeLock', 'transaction.build.options.extraSecurity']
])

function resolveParamId(id: string | string[] | undefined): string | undefined {
  if (Array.isArray(id)) {
    return id[0]
  }
  return id
}

function getScreenTitleKey(segments: readonly string[]) {
  const screen = segments.at(-1)
  if (!screen) {
    return undefined
  }
  return SCREEN_TITLE_KEYS.get(screen)
}

export default function SignAndSendLayout() {
  const params = useLocalSearchParams<AccountSearchParams>()
  const id = resolveParamId(params.id)
  const screenTitleKey = getScreenTitleKey(useSegments())

  const account = useAccountsStore((state) =>
    id ? state.accounts.find((entry) => entry.id === id) : undefined
  )

  const setAccountId = useTransactionBuilderStore((state) => state.setAccountId)

  useFocusEffect(() => {
    if (id) {
      setAccountId(id)
    }
  })

  // Navigating away (e.g. Open accounts) can remount this layout with a
  // missing id before unmount — never unwrap account for the header.
  if (!account) {
    return <Slot />
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () =>
            screenTitleKey ? (
              <SSText uppercase>{t(screenTitleKey)}</SSText>
            ) : (
              <SSHStack gap="sm">
                <SSText uppercase>{account.name}</SSText>
                {account.policyType === 'watchonly' ? (
                  <SSIconEyeOn stroke="#fff" height={16} width={16} />
                ) : null}
              </SSHStack>
            )
        }}
      />
      <Slot />
    </>
  )
}
