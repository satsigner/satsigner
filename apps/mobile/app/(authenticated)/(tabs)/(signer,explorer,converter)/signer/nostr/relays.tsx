import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_RELAYS, RELAY_PROTOCOL_PREFIX } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrRelay } from '@/types/models/Nostr'

type RelayRowProps = {
  relay: NostrRelay
  selected: boolean
  onPress: () => void
}

function RelayRow({ relay, selected, onPress }: RelayRowProps) {
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

export default function NostrRelays() {
  const router = useRouter()
  const storeRelays = useNostrIdentityStore((state) => state.relays)
  const setRelays = useNostrIdentityStore((state) => state.setRelays)

  const [selectedRelays, setSelectedRelays] = useState<string[]>(storeRelays)
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  function handleRelayToggle(relayUrl: string) {
    setSelectedRelays((prev) =>
      prev.includes(relayUrl)
        ? prev.filter((url) => url !== relayUrl)
        : [...prev, relayUrl]
    )
  }

  function handleAddCustomRelay() {
    if (!customRelayUrl) {
      return
    }
    const relayUrl = RELAY_PROTOCOL_PREFIX + customRelayUrl
    if (!selectedRelays.includes(relayUrl)) {
      setSelectedRelays((prev) => [...prev, relayUrl])
    }
    setCustomRelayUrl('')
  }

  function handleSave() {
    setRelays(selectedRelays)
    router.back()
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.relays.title')}</SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText uppercase>{t('nostrIdentity.relays.public')}</SSText>
            {NOSTR_RELAYS.map((relay) => (
              <RelayRow
                key={relay.url}
                relay={relay}
                onPress={() => handleRelayToggle(relay.url)}
                selected={selectedRelays.includes(relay.url)}
              />
            ))}
          </SSVStack>
          <SSVStack gap="md">
            <SSText uppercase>{t('nostrIdentity.relays.custom')}</SSText>
            {selectedRelays
              .filter((url) => !NOSTR_RELAYS.some((r) => r.url === url))
              .map((url) => (
                <RelayRow
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
                    placeholder={t('nostrIdentity.relays.inputPlaceholder')}
                    value={customRelayUrl}
                    align="left"
                    onChangeText={setCustomRelayUrl}
                  />
                </View>
              </SSHStack>
              <SSButton
                label={t('nostrIdentity.relays.addCustom')}
                variant="secondary"
                onPress={handleAddCustomRelay}
                disabled={!customRelayUrl.match(/^[a-z0-9]+\.[a-z0-9]+/i)}
              />
            </SSVStack>
          </SSVStack>
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={handleSave}
          />
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingBottom: 20,
    paddingTop: 10
  },
  relayInputAddOn: {
    backgroundColor: Colors.barGray,
    borderRadius: 2,
    paddingHorizontal: 7,
    paddingVertical: 14
  },
  relayInputContainer: {
    flexGrow: 1
  }
})
