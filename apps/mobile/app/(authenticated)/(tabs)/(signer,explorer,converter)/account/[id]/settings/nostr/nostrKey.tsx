import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { NostrAPI } from '@/api/nostr'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
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
    account?.nostr?.deviceNsec ?? ''
  )
  const [deviceNpub, setNpub] = useState<string>(
    account?.nostr?.deviceNpub ?? ''
  )
  const [loadingDefaultKeys, setLoadingDefaultKeys] = useState(false)

  async function loadDefaultNostrKeys() {
    if (loadingDefaultKeys || !account || !accountId) return

    setLoadingDefaultKeys(true)
    try {
      const keys = await NostrAPI.generateNostrKeys()
      if (keys) {
        setNsec(keys.nsec)
        setNpub(keys.npub)
        updateAccountNostr(accountId, {
          ...account.nostr,
          deviceNsec: keys.nsec,
          deviceNpub: keys.npub,
          lastUpdated: new Date()
        })
      }
    } catch (_error) {
      toast.error('Failed to generate device keys')
    } finally {
      setLoadingDefaultKeys(false)
    }
  }

  function saveChanges() {
    if (!accountId || !account?.nostr) return
    updateAccountNostr(accountId, {
      ...account.nostr,
      deviceNsec,
      deviceNpub,
      lastUpdated: new Date()
    })
    router.back()
  }

  if (!accountId || !account) return <Redirect href="/" />

  return (
    <SSMainLayout style={styles.mainLayout}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
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
            <SSText center>{t('account.nostrSync.commonNostrKeys')}</SSText>
            <SSVStack gap="xxs" style={styles.keysContainer}>
              {account.nostr?.commonNsec && account.nostr?.commonNpub ? (
                <>
                  <SSVStack gap="xxs">
                    <SSText color="muted" center>
                      {t('account.nostrSync.nsec')}
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
                      {t('account.nostrSync.npub')}
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
                <SSButton
                  label={t('account.nostrSync.generateCommonKeys')}
                  onPress={loadDefaultNostrKeys}
                  disabled={loadingDefaultKeys}
                />
              )}
            </SSVStack>
          </SSVStack>
          <SSVStack gap="sm">
            <SSText center>{t('account.nostrSync.deviceKeys')}</SSText>
            <SSVStack gap="xxs">
              <SSVStack gap="xxs">
                <SSText color="muted" center>
                  {t('account.nostrSync.nsec')}
                </SSText>
                <SSTextInput
                  value={deviceNsec}
                  onChangeText={setNsec}
                  placeholder={t('account.nostrSync.nsec')}
                  style={[styles.input, styles.monoInput]}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" center>
                  {t('account.nostrSync.npub')}
                </SSText>
                <SSTextInput
                  value={deviceNpub}
                  onChangeText={setNpub}
                  placeholder={t('account.nostrSync.npub')}
                  style={[styles.input, styles.monoInput]}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </SSVStack>
            </SSVStack>
          </SSVStack>
          <SSButton
            label={t('account.nostrSync.save')}
            onPress={saveChanges}
            disabled={!deviceNsec || !deviceNpub}
          />
        </SSVStack>
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
    padding: 10,
    minHeight: 80
  },
  monoInput: {
    fontFamily: 'SF-NS-Mono'
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
