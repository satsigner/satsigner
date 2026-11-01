import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import { probeIdentityRelays } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  NOSTR_RELAYS,
  NOSTR_RELAY_PROTOCOL_PREFIX,
  NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
} from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import {
  type NostrRelay,
  type NostrRelayConnectionInfo
} from '@/types/models/Nostr'
import {
  getNostrIdentityRelays,
  identityRelayConnectionQueryKey
} from '@/utils/nostrContacts'
import {
  connectedRelayUrls,
  hasNostrRelaysSelected,
  relayEditorSelection,
  relayStatusNote
} from '@/utils/nostrIdentity'

type RelaysParams = {
  npub: string
}

type RelayRowProps = {
  connectionInfo?: NostrRelayConnectionInfo
  connectionPending: boolean
  inUse: boolean
  relay: NostrRelay
  selected: boolean
  onPress: () => void
}

function relayFromUrl(url: string): NostrRelay {
  return (
    NOSTR_RELAYS.find((relay) => relay.url === url) ?? {
      name: url.replace(NOSTR_RELAY_PROTOCOL_PREFIX, ''),
      url
    }
  )
}

function RelayRow({
  connectionInfo,
  connectionPending,
  inUse,
  relay,
  selected,
  onPress
}: RelayRowProps) {
  const status = inUse
    ? relayStatusNote(relay.url, connectionInfo, connectionPending)
    : null
  const statusColor =
    status?.tone === 'ok'
      ? Colors.mainGreen
      : status?.tone === 'bad'
        ? Colors.mainRed
        : undefined

  return (
    <SSHStack gap="sm" justifyBetween>
      <SSHStack gap="sm" style={styles.relayRowMain}>
        <SSCheckbox selected={selected} onPress={onPress} />
        <SSVStack gap="none" style={styles.relayRowMain}>
          <SSText>{relay.name}</SSText>
          <SSText size="xs" color="muted">
            {relay.url}
          </SSText>
        </SSVStack>
      </SSHStack>
      {status ? (
        <SSText
          color={status.tone === 'pending' ? 'muted' : 'white'}
          size="xs"
          style={statusColor ? { color: statusColor } : undefined}
        >
          {status.label}
        </SSText>
      ) : null}
    </SSHStack>
  )
}

export default function NostrIdentityRelays() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<RelaysParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const globalRelays = useNostrIdentityStore((state) => state.relays)
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)
  const addGlobalRelay = useNostrIdentityStore((state) => state.addRelay)

  const explicitRelays = identity?.relays?.length
    ? identity.relays
    : globalRelays
  const usingDefaultRelays = !hasNostrRelaysSelected(
    identity?.relays,
    globalRelays
  )
  const effectiveRelays = getNostrIdentityRelays(identity?.relays, globalRelays)
  const connectionQuery = useQuery({
    enabled: !!identity && effectiveRelays.length > 0,
    queryFn: () => probeIdentityRelays(effectiveRelays),
    queryKey: identityRelayConnectionQueryKey(npub, effectiveRelays),
    refetchOnWindowFocus: false,
    retry: 0,
    staleTime: NOSTR_RELAY_REACHABILITY_STALE_TIME_MS
  })
  const connectedRelays = connectedRelayUrls(connectionQuery.data)
  const [relayOverride, setRelayOverride] = useState<string[] | null>(null)
  const selectedRelays = relayEditorSelection(
    explicitRelays,
    connectedRelays,
    relayOverride
  )
  const selectionReady = explicitRelays.length > 0 || connectionQuery.isFetched
  const [pinnedUrls, setPinnedUrls] = useState<string[] | null>(null)
  if (pinnedUrls === null && selectionReady) {
    setPinnedUrls(selectedRelays)
  }
  const sectionUrls = pinnedUrls ?? []
  const [customRelayUrl, setCustomRelayUrl] = useState(
    NOSTR_RELAY_PROTOCOL_PREFIX
  )
  const [searchQuery, setSearchQuery] = useState('')

  function handleRelayToggle(relayUrl: string) {
    setRelayOverride(
      selectedRelays.includes(relayUrl)
        ? selectedRelays.filter((url) => url !== relayUrl)
        : [...selectedRelays, relayUrl]
    )
  }

  function handleCustomRelayChange(value: string) {
    if (value.startsWith(NOSTR_RELAY_PROTOCOL_PREFIX)) {
      setCustomRelayUrl(value)
      return
    }
    const host = value.replace(/^wss?:?\/?\/?/, '')
    setCustomRelayUrl(NOSTR_RELAY_PROTOCOL_PREFIX + host)
  }

  function handleAddCustomRelay() {
    const relayUrl = customRelayUrl.trim()
    if (relayUrl === NOSTR_RELAY_PROTOCOL_PREFIX) {
      return
    }
    if (!selectedRelays.includes(relayUrl)) {
      setRelayOverride([...selectedRelays, relayUrl])
    }
    addGlobalRelay(relayUrl)
    setCustomRelayUrl(NOSTR_RELAY_PROTOCOL_PREFIX)
  }

  function handleSave() {
    if (!npub) {
      return
    }

    updateIdentity(npub, {
      relays: selectedRelays.length > 0 ? selectedRelays : undefined
    })

    toast.success(t('nostrIdentity.relays.saved'))
    router.back()
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>
                {t('nostrIdentity.settings.identityRelays')}
              </SSText>
            )
          }}
        />
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
              {t('nostrIdentity.settings.identityRelays')}
            </SSText>
          )
        }}
      />
      <SSScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          {sectionUrls.length > 0 ? (
            <SSVStack gap="sm">
              <SSText size="sm" color="muted" uppercase>
                {t('nostrIdentity.relays.selected')}
              </SSText>
              {sectionUrls.map((url) => (
                <RelayRow
                  key={url}
                  connectionInfo={connectionQuery.data}
                  connectionPending={connectionQuery.isFetching}
                  inUse={
                    effectiveRelays.includes(url) ||
                    selectedRelays.includes(url)
                  }
                  onPress={() => handleRelayToggle(url)}
                  relay={relayFromUrl(url)}
                  selected={selectedRelays.includes(url)}
                />
              ))}
            </SSVStack>
          ) : null}

          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.relays.custom')}
            </SSText>
            {selectedRelays
              .filter(
                (url) =>
                  !sectionUrls.includes(url) &&
                  !NOSTR_RELAYS.some((relay) => relay.url === url)
              )
              .map((url) => (
                <RelayRow
                  key={url}
                  connectionInfo={connectionQuery.data}
                  connectionPending={connectionQuery.isFetching}
                  inUse
                  onPress={() => handleRelayToggle(url)}
                  relay={relayFromUrl(url)}
                  selected
                />
              ))}
            <SSTextInput
              placeholder={t('nostrIdentity.relays.inputPlaceholder')}
              value={customRelayUrl}
              align="left"
              onChangeText={handleCustomRelayChange}
            />
            <SSButton
              label={t('nostrIdentity.relays.addCustom')}
              variant="outline"
              onPress={handleAddCustomRelay}
              disabled={
                !/^wss:\/\/[a-z0-9-]+\.[a-z0-9.-]+/i.test(customRelayUrl)
              }
            />
          </SSVStack>

          <SSVStack gap="sm">
            <SSText size="xs" color="muted">
              {t('nostrIdentity.settings.identityRelaysHint')}
            </SSText>
            {usingDefaultRelays ? (
              <SSText size="xs" color="muted">
                {t('nostrIdentity.relays.usingDefaultIndexers')}
              </SSText>
            ) : null}
            <SSTextInput
              placeholder={t('nostrIdentity.relays.search')}
              value={searchQuery}
              align="left"
              onChangeText={setSearchQuery}
            />
            {NOSTR_RELAYS.filter(
              (relay) =>
                !sectionUrls.includes(relay.url) &&
                (relay.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  relay.url.toLowerCase().includes(searchQuery.toLowerCase()))
            ).map((relay) => (
              <RelayRow
                key={relay.url}
                connectionInfo={connectionQuery.data}
                connectionPending={connectionQuery.isFetching}
                inUse={effectiveRelays.includes(relay.url)}
                relay={relay}
                selected={selectedRelays.includes(relay.url)}
                onPress={() => handleRelayToggle(relay.url)}
              />
            ))}
          </SSVStack>
        </SSVStack>
      </SSScrollView>
      <SSButton
        label={t('nostrIdentity.settings.save')}
        variant="secondary"
        onPress={handleSave}
        style={styles.saveButton}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16
  },
  emptyContainer: {
    paddingVertical: 60
  },
  list: {
    flex: 1
  },
  relayRowMain: {
    flex: 1
  },
  saveButton: {
    marginTop: 12
  }
})
