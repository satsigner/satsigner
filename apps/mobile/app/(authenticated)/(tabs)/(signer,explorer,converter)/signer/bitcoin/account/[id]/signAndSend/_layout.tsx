import { Slot, Stack, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from 'expo-router/react-navigation'

import { SSIconEyeOn } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function resolveParamId(id: string | string[] | undefined): string | undefined {
  if (Array.isArray(id)) {
    return id[0]
  }
  return id
}

export default function SignAndSendLayout() {
  const params = useLocalSearchParams<AccountSearchParams>()
  const id = resolveParamId(params.id)

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
          headerTitle: () => (
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
