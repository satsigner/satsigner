import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

export default function AccountSettings() {
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.name === id)
    ])
  )

  if (!account) return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{id}</SSText>
        }}
      />
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          Master Key Settings and Tools
        </SSText>
        <SSVStack itemsCenter gap="none">
          <SSHStack gap="sm">
            <SSText color="muted">Fingerprint</SSText>
            <SSText style={{ color: Colors.success }}>23af61ff</SSText>
          </SSHStack>
          <SSHStack gap="sm">
            <SSText color="muted">Created on</SSText>
            <SSText>Jan 3, 20257 03:09:00 UTC</SSText>
          </SSHStack>
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton style={{ flex: 1 }} label="VIEW SEED" />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT LABELS"
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label="IMPORT LABELS"
              variant="gradient"
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="REPLACE KEY"
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT CONFIG"
              variant="gradient"
            />
          </SSHStack>
        </SSVStack>
        <SSVStack gap="sm" style={{ marginTop: 20 }}>
          <SSVStack gap="xs">
            <SSText center>Account Name</SSText>
            <SSTextInput />
          </SSVStack>
          <SSVStack gap="xs">
            <SSText center>Network</SSText>
            <SSTextInput />
          </SSVStack>
          <SSVStack gap="xs">
            <SSText center>Policy Type</SSText>
            <SSTextInput />
          </SSVStack>
          <SSVStack gap="xs">
            <SSText center>Script Version</SSText>
            <SSTextInput />
          </SSVStack>
        </SSVStack>
        <SSVStack style={{ marginTop: 60 }}>
          <SSButton label="DUPLICATE MASTER KEY" />
          <SSButton
            label="DELETE MASTER KEY"
            style={{
              backgroundColor: Colors.error
            }}
          />
          <SSButton label="SAVE" variant="secondary" />
        </SSVStack>
      </SSVStack>
    </ScrollView>
  )
}
