import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
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
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

type SSNostrRelayProps = {
  relay: NostrRelay
  selected: boolean
  onPress: () => void
}

const RELAY_PROTOCOL_PREFIX = 'wss://'

function SSNostrRelaysSelection() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const [selectedRelays, setSelectedRelays] = useState<string[]>(
    account?.nostr.relays || []
  )

  function saveChanges() {
    if (!accountId) return
    updateAccountNostr(accountId, { relays: selectedRelays })
    router.back()
  }

  function handleRelayToggle(relayUrl: string) {
    const newSelectedRelays = selectedRelays.includes(relayUrl)
      ? selectedRelays.filter((url) => url !== relayUrl)
      : [...selectedRelays, relayUrl]

    setSelectedRelays(newSelectedRelays)
  }

  function handleAddCustomRelay() {
    if (!customRelayUrl) return

    const relayUrl = RELAY_PROTOCOL_PREFIX + customRelayUrl

    if (!selectedRelays.includes(relayUrl)) {
      setSelectedRelays([...selectedRelays, relayUrl])
    }

    setCustomRelayUrl('')
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.nostrSync.selectRelays')}</SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText uppercase>{t('account.nostrSync.relays.public')}</SSText>
            {NOSTR_RELAYS.map((relay) => (
              <SSNostrRelay
                key={relay.url}
                relay={relay}
                onPress={() => handleRelayToggle(relay.url)}
                selected={selectedRelays.includes(relay.url)}
              />
            ))}
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('account.nostrSync.relays.custom')}</SSText>
            {selectedRelays
              .filter((url) => !NOSTR_RELAYS.some((relay) => relay.url === url))
              .map((url) => (
                <SSNostrRelay
                  key={url}
                  selected
                  relay={{
                    name: url.replace(RELAY_PROTOCOL_PREFIX, ''),
                    url
                  }}
                  onPress={() => handleRelayToggle(url)}
                />
              ))}
            <SSVStack gap="sm">
              <SSHStack gap="xs">
                <SSText color="muted" size="lg" style={styles.relayInputAddOn}>
                  {RELAY_PROTOCOL_PREFIX}
                </SSText>
                <View style={styles.relayInputContainer}>
                  <SSTextInput
                    placeholder={t('account.nostrSync.relays.inputPlaceholder')}
                    value={customRelayUrl}
                    align="left"
                    onChangeText={setCustomRelayUrl}
                  />
                </View>
              </SSHStack>
              <SSButton
                label={t('account.nostrSync.relays.addCustomRelay')}
                variant="secondary"
                onPress={handleAddCustomRelay}
                disabled={!customRelayUrl.match(/^[a-z0-9]+\.[a-z0-9]+$/i)}
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
        <SSText>{relay.name}</SSText>
        <SSText size="xs" color="muted">
          {relay.url}
        </SSText>
      </SSVStack>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingBottom: 20,
    paddingTop: 10
  },
  relayInputAddOn: {
    backgroundColor: Colors.barGray,
    paddingVertical: 14,
    paddingHorizontal: 7,
    borderRadius: 2
  },
  relayInputContainer: {
    flexGrow: 1
  }
})

export default SSNostrRelaysSelection
