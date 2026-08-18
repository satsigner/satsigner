import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSNostrContactList from '@/components/SSNostrContactList'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import {
  type NostrChatProtocol,
  type NostrContactItem
} from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import { getNostrContactsRelays } from '@/utils/nostrContacts'

type NewChatParams = {
  npub: string
  protocol?: string
}

export default function NostrNewChat() {
  const router = useRouter()
  const { npub, protocol: protocolParam } =
    useLocalSearchParams<NewChatParams>()
  const protocol: NostrChatProtocol =
    protocolParam === 'nip04' ? 'nip04' : 'nip17'

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const [npubInput, setNpubInput] = useState('')
  const [inputError, setInputError] = useState('')

  const searchQuery = npubInput.trim().toLowerCase()

  const contactsRelays = getNostrContactsRelays(identity?.relays)
  const {
    contacts,
    connectedRelayCount,
    isError,
    isLoading,
    kind3Found,
    relaysQueried
  } = useNostrContacts(npub, contactsRelays)

  // The input doubles as a search over our follows: anything that is not a
  // valid npub filters the contact list by name, NIP-05 or npub.
  const filteredContacts = useMemo(() => {
    if (!searchQuery) {
      return contacts
    }
    return contacts.filter((contact) => {
      const displayName = contact.profile?.displayName?.toLowerCase() ?? ''
      const nip05 = contact.profile?.nip05?.toLowerCase() ?? ''
      return (
        displayName.includes(searchQuery) ||
        nip05.includes(searchQuery) ||
        nip19.npubEncode(contact.pubkey).includes(searchQuery)
      )
    })
  }, [contacts, searchQuery])

  function openThread(peerNpub: string) {
    if (!npub) {
      return
    }
    router.replace({
      params: { npub, peer: peerNpub, protocol },
      pathname: '/signer/nostr/account/[npub]/chat/[peer]'
    })
  }

  function handleOpenInput() {
    const trimmed = npubInput.trim()
    if (!getPubKeyHexFromNpub(trimmed)) {
      setInputError(t('nostrIdentity.chat.invalidNpub'))
      return
    }
    openThread(trimmed)
  }

  function handleContactPress(item: NostrContactItem) {
    openThread(nip19.npubEncode(item.pubkey))
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.chat.newMessage')}</SSText>
          )
        }}
      />
      <SSVStack gap="md" style={styles.container}>
        <SSVStack gap="sm">
          <SSTextInput
            value={npubInput}
            onChangeText={(text) => {
              setNpubInput(text)
              setInputError('')
            }}
            placeholder={t('nostrIdentity.chat.npubPlaceholder')}
            align="left"
            error={inputError || undefined}
          />
          <SSButton
            label={t('nostrIdentity.chat.startChat')}
            onPress={handleOpenInput}
            disabled={!npubInput.trim()}
          />
        </SSVStack>

        <View style={styles.listContainer}>
          {isLoading && contacts.length === 0 ? (
            <SSVStack itemsCenter style={styles.center}>
              <ActivityIndicator color={Colors.gray[400]} />
            </SSVStack>
          ) : isError ? (
            <SSVStack itemsCenter gap="sm" style={styles.center}>
              <SSText color="muted" size="sm">
                {t('nostrIdentity.account.relayAllFailed')}
              </SSText>
            </SSVStack>
          ) : !kind3Found ? (
            <SSVStack itemsCenter gap="sm" style={styles.center}>
              <SSText color="muted" size="sm" center>
                {connectedRelayCount === 0
                  ? t('nostrIdentity.contacts.kind3NotFoundNoConn')
                  : t('nostrIdentity.contacts.kind3NotFound', {
                      connected: connectedRelayCount,
                      total: relaysQueried.length
                    })}
              </SSText>
            </SSVStack>
          ) : contacts.length === 0 ? (
            <SSVStack itemsCenter style={styles.center}>
              <SSText color="muted" size="sm">
                {t('nostrIdentity.contacts.empty')}
              </SSText>
            </SSVStack>
          ) : filteredContacts.length === 0 ? (
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
          )}
        </View>
      </SSVStack>
    </SSMainLayout>
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
