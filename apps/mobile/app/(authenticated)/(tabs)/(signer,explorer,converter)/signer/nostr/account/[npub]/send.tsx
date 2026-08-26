import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSNostrContactList from '@/components/SSNostrContactList'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_EMPTY_STATE_PADDING_VERTICAL } from '@/constants/nostr'
import { useNostrContacts } from '@/hooks/useNostrContacts'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type NostrContactItem } from '@/types/models/Nostr'
import { getPubKeyHexFromNpub } from '@/utils/nostr'
import {
  contactToIdentity,
  getNostrContactsRelays
} from '@/utils/nostrContacts'

type SendParams = {
  npub: string
}

export default function NostrFollowingSend() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SendParams>()
  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const [npubInput, setNpubInput] = useState('')
  const [inputError, setInputError] = useState('')

  const searchQuery = npubInput.trim().toLowerCase()

  const contactsRelays = getNostrContactsRelays(identity?.relays)

  const { contacts, isError, isLoading } = useNostrContacts(
    npub,
    contactsRelays
  )

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

  function openContact(targetNpub: string) {
    router.navigate({
      params: { npub, targetNpub },
      pathname: '/signer/nostr/account/[npub]/contact/[targetNpub]'
    })
  }

  function handleSendInput() {
    const trimmed = npubInput.trim()
    if (!getPubKeyHexFromNpub(trimmed)) {
      setInputError(t('nostrIdentity.send.invalidNpub'))
      return
    }
    openContact(trimmed)
  }

  function handlePressRow(item: NostrContactItem) {
    openContact(contactToIdentity(item).npub)
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.centered}>
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
              {t('nostrIdentity.account.followingTitle')}
            </SSText>
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
            placeholder={t('nostrIdentity.send.npubPlaceholder')}
            align="left"
            error={inputError || undefined}
          />
          <SSButton
            label={t('nostrIdentity.send.send')}
            onPress={handleSendInput}
            disabled={!npubInput.trim()}
          />
        </SSVStack>

        <View style={styles.listContainer}>
          {isLoading && contacts.length === 0 ? (
            <SSVStack itemsCenter gap="md" style={styles.centered}>
              <ActivityIndicator color={Colors.white} size="large" />
              <SSText color="muted">
                {t('nostrIdentity.account.followingLoading')}
              </SSText>
            </SSVStack>
          ) : isError ? (
            <SSVStack itemsCenter gap="md" style={styles.centered}>
              <SSText color="muted" center>
                {t('nostrIdentity.account.eventNotFound')}
              </SSText>
            </SSVStack>
          ) : contacts.length === 0 ? (
            <SSVStack itemsCenter gap="md" style={styles.centered}>
              <SSText color="muted" center>
                {t('nostrIdentity.account.followingEmpty')}
              </SSText>
            </SSVStack>
          ) : filteredContacts.length === 0 ? (
            <SSVStack itemsCenter gap="md" style={styles.centered}>
              <SSText color="muted" center>
                {t('nostrIdentity.send.noMatchingContacts')}
              </SSText>
            </SSVStack>
          ) : (
            <SSNostrContactList
              contacts={filteredContacts}
              onPress={handlePressRow}
            />
          )}
        </View>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: NOSTR_EMPTY_STATE_PADDING_VERTICAL
  },
  container: {
    flex: 1
  },
  listContainer: {
    flex: 1
  }
})
