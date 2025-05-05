import { router, useLocalSearchParams, Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, ActivityIndicator } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

function NostrKeys() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const [deviceNsec, setNsec] = useState<string>(
    account?.nostr.deviceNsec || ''
  )
  const [deviceNpub, setNpub] = useState<string>(
    account?.nostr.deviceNpub || ''
  )
  const [loadingDefaultKeys, setLoadingDefaultKeys] = useState(false)

  async function loadDefaultNostrKeys() {
    if (loadingDefaultKeys || !account) return

    setLoadingDefaultKeys(false)
  }

  function saveChanges() {
    if (!accountId) return
    updateAccountNostr(accountId, {
      deviceNsec,
      deviceNpub
    })
    router.back()
  }

  return (
    <SSMainLayout style={styles.mainLayout}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account?.name}</SSText>
              {account?.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
          headerRight: () => null
        }}
      />
      <SSVStack style={styles.pageContainer}>
        <SSVStack gap="lg">
          <SSVStack gap="sm">
            <SSText center>{t('account.nostrlabels.commonNostrKeys')}</SSText>
            <SSVStack gap="xxs" style={styles.keysContainer}>
              {account?.nostr.commonNsec && account?.nostr.commonNpub ? (
                <>
                  <SSVStack gap="xxs">
                    <SSText color="muted" center>
                      {t('account.nostrlabels.nsec')}
                    </SSText>
                    <SSTextClipboard text={account.nostr.commonNsec}>
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                        selectable
                      >
                        {account.nostr.commonNsec.slice(0, 12) +
                          '...' +
                          account.nostr.commonNsec.slice(-4)}
                      </SSText>
                    </SSTextClipboard>
                  </SSVStack>
                  <SSVStack gap="xxs">
                    <SSText color="muted" center>
                      {t('account.nostrlabels.npub')}
                    </SSText>
                    <SSTextClipboard text={account.nostr.commonNpub}>
                      <SSText
                        center
                        size="xl"
                        type="mono"
                        style={styles.keyText}
                        selectable
                      >
                        {account.nostr.commonNpub.slice(0, 12) +
                          '...' +
                          account.nostr.commonNpub.slice(-4)}
                      </SSText>
                    </SSTextClipboard>
                  </SSVStack>
                </>
              ) : (
                <SSHStack style={styles.keyContainerLoading}>
                  <ActivityIndicator />
                  <SSText uppercase>
                    {t('account.nostrlabels.loadingKeys')}
                  </SSText>
                </SSHStack>
              )}
            </SSVStack>
          </SSVStack>

          <SSVStack gap="sm">
            <SSText center>Custom Device Keys</SSText>
            <SSVStack gap="none">
              <SSText color="muted">npub</SSText>
              <SSTextInput
                value={deviceNpub}
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
                value={deviceNsec}
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
  },
  keysContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderColor: Colors.white,
    padding: 10,
    paddingBottom: 30,
    paddingHorizontal: 28
  },
  keyText: {
    letterSpacing: 1
  },
  keyContainerLoading: {
    justifyContent: 'center',
    paddingVertical: 10
  }
})

export default NostrKeys
