import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_RELAYS } from '@/constants/nostr'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import SSHStack from '@/layouts/SSHStack'

function SSNostrRelaysSelection() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  const selectedRelays: string[] = account?.nostr.relays || []

  function handleRelayToggle(relayUrl: string) {
    if (!account) return

    const newSelectedRelays = selectedRelays.includes(relayUrl)
      ? selectedRelays.filter((url) => url !== relayUrl)
      : [...selectedRelays, relayUrl]

    updateAccount({
      ...account,
      nostr: {
        ...account.nostr,
        relays: newSelectedRelays
      }
    })
  }

  function handleAddCustomRelay() {
    if (!customRelayUrl || !account) return

    if (!customRelayUrl.startsWith('wss://')) {
      return
    }

    if (!selectedRelays.includes(customRelayUrl)) {
      const newSelectedRelays = [...selectedRelays, customRelayUrl]
      updateAccount({
        ...account,
        nostr: {
          ...account.nostr,
          relays: newSelectedRelays
        }
      })
    }

    setCustomRelayUrl('')
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.nostrlabels.selectRelays')}</SSText>
          )
        }}
      />
      <SSMainLayout style={{ paddingTop: 10, paddingBottom: 20 }}>
        <SSVStack gap="md">
          {NOSTR_RELAYS.map((relay) => (
            <SSHStack key={relay.url} gap="sm">
              <SSCheckbox
                selected={selectedRelays.includes(relay.url)}
                onPress={() => handleRelayToggle(relay.url)}
              />
              <SSVStack gap="none">
                <SSText weight='bold'>{relay.name}</SSText>
                <SSText size="xs" color="muted">{relay.url}</SSText>
              </SSVStack>
            </SSHStack>
          ))}
          <SSVStack gap="sm">
            <SSText>{t('account.nostrlabels.addCustomRelay')}</SSText>
            <SSTextInput
              placeholder="wss://your-relay.com"
              value={customRelayUrl}
              onChangeText={setCustomRelayUrl}
            />
            <SSButton
              label={t('account.nostrlabels.addRelay')}
              variant="secondary"
              onPress={handleAddCustomRelay}
              disabled={!customRelayUrl.startsWith('wss://')}
            />
          </SSVStack>
          {selectedRelays
            .filter((url) => !NOSTR_RELAYS.some((relay) => relay.url === url))
            .map((url) => (
              <SSVStack key={url} gap="xxs">
                <SSCheckbox
                  selected
                  onPress={() => handleRelayToggle(url)}
                />
              </SSVStack>
            ))}
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

export default SSNostrRelaysSelection
