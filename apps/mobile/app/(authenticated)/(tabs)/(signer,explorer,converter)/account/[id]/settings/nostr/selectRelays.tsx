import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_RELAYS, type NostrRelay } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

type SSNostrRelayProps = {
  relay: NostrRelay
  selected: boolean
  onPress: () => void
}

function SSNostrRelaysSelection() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  const [selectedRelays, setSelectedRelays] = useState<string[]>(
    account?.nostr.relays || []
  )

  function saveChanges() {
    if (!account) return
    updateAccount({
      ...account,
      nostr: { ...account.nostr, relays: selectedRelays }
    })
    router.back()
  }

  function handleRelayToggle(relayUrl: string) {
    if (!account) return

    const newSelectedRelays = selectedRelays.includes(relayUrl)
      ? selectedRelays.filter((url) => url !== relayUrl)
      : [...selectedRelays, relayUrl]

    setSelectedRelays(newSelectedRelays)
  }

  function handleAddCustomRelay() {
    if (!customRelayUrl || !account) return

    if (!customRelayUrl.startsWith('wss://')) {
      return
    }

    if (!selectedRelays.includes(customRelayUrl)) {
      setSelectedRelays([...selectedRelays, customRelayUrl])
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
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText uppercase weight="bold" size="md">
              Public Relays
            </SSText>
            {NOSTR_RELAYS.map((relay) => (
              <SSNostrRelay
                key={relay.url}
                relay={relay}
                onPress={() => handleRelayToggle(relay.url)}
                selected={selectedRelays.includes(relay.url)}
              />
            ))}
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase weight="bold" size="md">
              CUSTOM RELAYS
            </SSText>
            {selectedRelays
              .filter((url) => !NOSTR_RELAYS.some((relay) => relay.url === url))
              .map((url) => (
                <SSNostrRelay
                  key={url}
                  selected
                  relay={{ name: 'CUSTOM', url }}
                  onPress={() => handleRelayToggle(url)}
                />
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
          </SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={saveChanges}
          />
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

function SSNostrRelay({ relay, selected, onPress }: SSNostrRelayProps) {
  return (
    <SSHStack gap="sm">
      <SSCheckbox selected={selected} onPress={onPress} />
      <SSVStack gap="none">
        <SSText weight="bold">{relay.name}</SSText>
        <SSText size="xs" color="muted">
          {relay.url}
        </SSText>
      </SSVStack>
    </SSHStack>
  )
}

export default SSNostrRelaysSelection
