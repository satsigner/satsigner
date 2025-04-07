import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

const POPULAR_RELAYS = [
  { url: 'wss://nos.lol', name: 'Nos.lol' },
  { url: 'wss://nostr.mom', name: 'Nostr Mom' },
  { url: 'wss://nostr.wine', name: 'Nostr Wine' },
  { url: 'wss://offchain.pub', name: 'Offchain' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://relay.snort.social', name: 'Snort' }
]

export default function SelectRelays() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.updateAccount
    ])
  )

  const selectedRelays = account?.nostrRelays ?? []

  function handleRelayToggle(relayUrl: string) {
    if (!account) return

    const newSelectedRelays = selectedRelays.includes(relayUrl)
      ? selectedRelays.filter((url) => url !== relayUrl)
      : [...selectedRelays, relayUrl]

    updateAccount({
      ...account,
      nostrRelays: newSelectedRelays
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
        nostrRelays: newSelectedRelays
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
      <SSVStack gap="md" style={{ padding: 20 }}>
        {POPULAR_RELAYS.map((relay) => (
          <SSVStack key={relay.url} gap="xxs">
            <SSCheckbox
              label={relay.url}
              selected={selectedRelays.includes(relay.url)}
              onPress={() => handleRelayToggle(relay.url)}
            />
          </SSVStack>
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
          .filter((url) => !POPULAR_RELAYS.some((relay) => relay.url === url))
          .map((url) => (
            <SSVStack key={url} gap="xxs">
              <SSCheckbox
                label={url}
                selected
                onPress={() => handleRelayToggle(url)}
              />
            </SSVStack>
          ))}
      </SSVStack>
    </ScrollView>
  )
}
