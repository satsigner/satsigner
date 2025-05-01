import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useNostrLabelSync from '@/hooks/useNostrLabelSync'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function NostrKeys() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const { generateCommonNostrKeys } = useNostrLabelSync()

  const [nsec, setNsec] = useState<string>(account?.nostr.commonNsec || '')
  const [npub, setNpub] = useState<string>(account?.nostr.commonNpub || '')
  const [loadingDefaultKeys, setLoadingDefaultKeys] = useState(false)

  async function loadDefaultNostrKeys() {
    if (loadingDefaultKeys || !account) return
    setLoadingDefaultKeys(true)
    const keys = await generateCommonNostrKeys(account)
    if (keys) {
      setNsec(keys.nsec as string)
      setNpub(keys.npub as string)
    }
    setLoadingDefaultKeys(false)
  }

  function saveChanges() {
    if (!accountId) return
    updateAccountNostr(accountId, { commonNsec: nsec, commonNpub: npub })
    router.back()
  }

  return (
    <SSMainLayout style={styles.mainLayout}>
      <SSVStack style={styles.pageContainer}>
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText uppercase weight="bold" size="lg">
              CUSTOM KEYS
            </SSText>
            <SSText>Enter your custom keys below.</SSText>
            <SSVStack gap="none">
              <SSText color="muted">npub</SSText>
              <SSTextInput
                value={npub}
                onChangeText={setNpub}
                multiline
                numberOfLines={3}
                blurOnSubmit
                size="small"
                style={styles.input}
              />
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="muted">nsec</SSText>
              <SSTextInput
                value={nsec}
                onChangeText={setNsec}
                multiline
                numberOfLines={3}
                blurOnSubmit
                size="small"
                style={styles.input}
              />
            </SSVStack>
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase weight="bold" size="lg">
              DETERMINISTIC KEYS
            </SSText>
            <SSText>Use keys derived from this account descriptor.</SSText>
            <SSButton
              label="USE DEFAULT ACCOUNT KEYS"
              variant="outline"
              loading={loadingDefaultKeys}
              onPress={loadDefaultNostrKeys}
            />
          </SSVStack>
        </SSVStack>
        <SSButton label="SAVE" variant="secondary" onPress={saveChanges} />
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingTop: 10,
    paddingBottom: 20
  },
  pageContainer: {
    justifyContent: 'space-between',
    flex: 1
  },
  input: {
    height: 'auto',
    padding: 10
  }
})

export default NostrKeys
