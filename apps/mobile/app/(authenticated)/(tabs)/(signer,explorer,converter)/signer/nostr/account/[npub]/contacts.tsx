import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import * as nostrKinds from 'nostr-tools/kinds'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import { NostrAPI } from '@/api/nostr'
import SSButton from '@/components/SSButton'
import SSNostrContactList from '@/components/SSNostrContactList'
import SSNostrSourceBanner from '@/components/SSNostrSourceBanner'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_RELAYS } from '@/constants/nostr'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrContactItem } from '@/types/models/Nostr'
import { getSecretFromNsec } from '@/utils/nostr'
import {
  filterNostrContacts,
  getNostrContactsRelays
} from '@/utils/nostrContacts'
import {
  getNostrErrorMessage,
  getNostrErrorMessageForCode
} from '@/utils/nostrErrorMessage'
import { nostrContactProfileHref } from '@/utils/nostrNavigation'

type ContactsParams = {
  npub: string
}

export default function NostrContacts() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<ContactsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)

  const contactsRelays = getNostrContactsRelays(identity?.relays)

  const {
    contacts,
    connectedRelayCount,
    error: contactsError,
    isError,
    isLoading,
    isRefetching,
    kind3Found,
    refetch,
    relaysQueried,
    source
  } = useNostrContacts(npub, contactsRelays)

  const filteredContacts = filterNostrContacts(contacts, searchQuery)

  function handleContactPress(item: NostrContactItem) {
    const contactNpub = nip19.npubEncode(item.pubkey)
    router.navigate(nostrContactProfileHref(npub, contactNpub))
  }

  async function handlePublishKind3() {
    if (!identity?.nsec || !npub) {
      return
    }

    const secretKey = getSecretFromNsec(identity.nsec)
    if (!secretKey) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    const identityRelayUrls = new Set(contactsRelays)
    const otherRelays = NOSTR_RELAYS.map((r) => r.url).filter(
      (url) => !identityRelayUrls.has(url)
    )

    if (otherRelays.length === 0) {
      toast(t('nostrIdentity.contacts.noOtherRelays'))
      return
    }

    setIsPublishing(true)
    let result:
      | Awaited<ReturnType<NostrAPI['fetchKind3FollowingPubkeys']>>
      | undefined
    try {
      const sourceApi = new NostrAPI(contactsRelays)
      result = await sourceApi.fetchKind3FollowingPubkeys(npub)
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.contacts.publishError')}: ${getNostrErrorMessage(error)}`
      )
      setIsPublishing(false)
      return
    }
    setIsPublishing(false)

    if (!result) {
      return
    }

    if (result.error) {
      toast.error(getNostrErrorMessageForCode(result.error))
      return
    }
    if (!result.data.kind3Found || result.data.pubkeys.length === 0) {
      toast.error(t('nostrIdentity.contacts.kind3NotFoundNoConn'))
      return
    }

    setIsPublishing(true)
    try {
      const tags = result.data.pubkeys.map((pk) => ['p', pk])

      const targetApi = new NostrAPI(otherRelays)
      await targetApi.connectForPublish()

      const signer = new NDKPrivateKeySigner(secretKey)
      const event = new NDKEvent(undefined, {
        content: '',
        kind: nostrKinds.Contacts,
        tags
      })
      await event.sign(signer)

      await targetApi.publishEvent(event)

      toast.success(
        t('nostrIdentity.contacts.publishSuccess', {
          count: result.data.pubkeys.length,
          relays: otherRelays.length
        })
      )
    } catch (error) {
      toast.error(
        `${t('nostrIdentity.contacts.publishError')}: ${getNostrErrorMessage(error)}`
      )
    }
    setIsPublishing(false)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.contacts.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="md" style={styles.container}>
        <SSTextInput
          placeholder={t('nostrIdentity.contacts.searchPlaceholder')}
          value={searchQuery}
          align="left"
          onChangeText={setSearchQuery}
        />
        <SSNostrSourceBanner
          error={contactsError}
          onRetry={refetch}
          retrying={isRefetching}
          source={source}
        />
        <View style={styles.listContainer}>
          {isLoading && contacts.length === 0 ? (
            <SSVStack itemsCenter style={styles.center}>
              <ActivityIndicator color={Colors.gray[400]} />
            </SSVStack>
          ) : contacts.length > 0 ? (
            filteredContacts.length === 0 ? (
              <SSVStack itemsCenter style={styles.center}>
                <SSText color="muted" size="sm" center>
                  {t('nostrIdentity.chat.noMatchingContacts')}
                </SSText>
              </SSVStack>
            ) : (
              <SSNostrContactList
                contacts={filteredContacts}
                onPress={handleContactPress}
              />
            )
          ) : isError ? (
            <SSVStack itemsCenter gap="sm" style={styles.center}>
              <SSText color="muted" size="sm">
                {t('nostrIdentity.account.relayAllFailed')}
              </SSText>
              <RelayList relays={contactsRelays} />
            </SSVStack>
          ) : !kind3Found ? (
            <SSVStack itemsCenter gap="sm" style={styles.center}>
              <SSText color="muted" size="sm">
                {connectedRelayCount === 0
                  ? t('nostrIdentity.contacts.kind3NotFoundNoConn')
                  : t('nostrIdentity.contacts.kind3NotFound', {
                      connected: connectedRelayCount,
                      total: relaysQueried.length
                    })}
              </SSText>
              <RelayList
                relays={
                  relaysQueried.length > 0 ? relaysQueried : contactsRelays
                }
              />
            </SSVStack>
          ) : (
            <SSVStack itemsCenter style={styles.center}>
              <SSText color="muted" size="sm">
                {t('nostrIdentity.contacts.empty')}
              </SSText>
            </SSVStack>
          )}
        </View>
        {kind3Found && contacts.length > 0 && identity?.nsec && (
          <SSButton
            label={t('nostrIdentity.contacts.publishToOtherRelays')}
            variant="outline"
            onPress={handlePublishKind3}
            loading={isPublishing}
            disabled={isPublishing}
          />
        )}
      </SSVStack>
    </SSMainLayout>
  )
}

type RelayListProps = {
  relays: string[]
}

function RelayList({ relays }: RelayListProps) {
  return (
    <SSVStack gap="none" itemsCenter>
      {relays.map((url) => (
        <SSText key={url} size="xs" color="muted">
          {url}
        </SSText>
      ))}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  container: {
    flex: 1
  },
  listContainer: {
    flex: 1
  }
})
