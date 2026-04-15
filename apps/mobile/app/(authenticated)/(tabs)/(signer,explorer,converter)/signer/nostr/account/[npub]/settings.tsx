import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Image, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

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

type SettingsParams = {
  npub: string
}

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

export default function NostrIdentitySettings() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SettingsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const updateIdentity = useNostrIdentityStore(
    (state) => state.updateIdentity
  )
  const removeIdentity = useNostrIdentityStore(
    (state) => state.removeIdentity
  )

  const [displayName, setDisplayName] = useState(
    identity?.displayName ?? ''
  )
  const [pictureUrl, setPictureUrl] = useState(identity?.picture ?? '')
  const [selectedRelays, setSelectedRelays] = useState<string[]>(
    identity?.relays ?? globalRelays
  )
  const [customRelayUrl, setCustomRelayUrl] = useState('')

  function handleRelayToggle(relayUrl: string) {
    setSelectedRelays((prev) =>
      prev.includes(relayUrl)
        ? prev.filter((url) => url !== relayUrl)
        : [...prev, relayUrl]
    )
  }

  function handleAddCustomRelay() {
    if (!customRelayUrl) return
    const relayUrl = RELAY_PROTOCOL_PREFIX + customRelayUrl
    if (!selectedRelays.includes(relayUrl)) {
      setSelectedRelays((prev) => [...prev, relayUrl])
    }
    setCustomRelayUrl('')
  }

  function handleSave() {
    if (!npub) return

    updateIdentity(npub, {
      displayName: displayName || undefined,
      picture: pictureUrl || undefined,
      relays: selectedRelays.length > 0 ? selectedRelays : undefined
    })

    toast.success(t('nostrIdentity.settings.saved'))
    router.back()
  }

  function handleDelete() {
    Alert.alert(
      t('nostrIdentity.settings.deleteIdentity'),
      t('nostrIdentity.settings.deleteConfirm'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          style: 'destructive',
          text: t('common.delete'),
          onPress: () => {
            removeIdentity(npub)
            router.navigate('/signer/nostr')
          }
        }
      ]
    )
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('nostrIdentity.settings.title')}
            </SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSVStack itemsCenter gap="sm">
            <View style={styles.avatarContainer}>
              {pictureUrl ? (
                <Image
                  source={{ uri: pictureUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <SSText size="3xl" weight="bold">
                    {displayName?.[0]?.toUpperCase() || 'N'}
                  </SSText>
                </View>
              )}
            </View>
          </SSVStack>

          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.displayName')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.displayNamePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              align="left"
            />
          </SSVStack>

          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.picture')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.picturePlaceholder')}
              value={pictureUrl}
              onChangeText={setPictureUrl}
              align="left"
              autoCapitalize="none"
              keyboardType="url"
            />
            <SSText size="xs" color="muted">
              {t('nostrIdentity.profile.pictureHint')}
            </SSText>
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.settings.manageKeys')}
            variant="outline"
            onPress={() =>
              router.navigate({
                pathname: '/signer/nostr/account/[npub]/keys',
                params: { npub }
              })
            }
          />

          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.settings.identityRelays')}
            </SSText>
            <SSText size="xs" color="muted">
              {t('nostrIdentity.settings.identityRelaysHint')}
            </SSText>
            {NOSTR_RELAYS.map((relay) => (
              <RelayRow
                key={relay.url}
                relay={relay}
                selected={selectedRelays.includes(relay.url)}
                onPress={() => handleRelayToggle(relay.url)}
              />
            ))}
          </SSVStack>

          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.relays.custom')}
            </SSText>
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
              variant="outline"
              onPress={handleAddCustomRelay}
              disabled={!customRelayUrl.match(/^[a-z0-9]+\.[a-z0-9]+/i)}
            />
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.settings.save')}
            variant="secondary"
            onPress={handleSave}
          />

          <SSButton
            label={t('nostrIdentity.settings.deleteIdentity')}
            variant="danger"
            onPress={handleDelete}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 40,
    height: 80,
    width: 80
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  content: {
    paddingBottom: 40
  },
  emptyContainer: {
    paddingVertical: 60
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
