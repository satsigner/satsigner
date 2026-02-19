import * as Clipboard from 'expo-clipboard'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconEyeOff from '@/components/icons/SSIconEyeOff'
import SSIconEyeOn from '@/components/icons/SSIconEyeOn'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useNostrSync from '@/hooks/useNostrSync'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { deriveNpubFromNsec, generateColorFromNpub } from '@/utils/nostr'

type QrModalContent = {
  type: 'npub' | 'nsec'
  value: string
}

function NostrKeys() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountNostr] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccountNostr
    ])
  )

  const { generateCommonNostrKeys } = useNostrSync()

  const [deviceNsec, setNsec] = useState<string>(
    account?.nostr?.deviceNsec ?? ''
  )
  const [nsecRevealed, setNsecRevealed] = useState(false)
  const [commonNsecRevealed, setCommonNsecRevealed] = useState(false)
  const [loadingCommonKeys, setLoadingCommonKeys] = useState(false)

  const derivedNpub = useMemo(
    () => deriveNpubFromNsec(deviceNsec),
    [deviceNsec]
  )

  const [deviceColor, setDeviceColor] = useState('#404040')
  const [qrModal, setQrModal] = useState<QrModalContent | null>(null)

  useEffect(() => {
    if (derivedNpub) {
      generateColorFromNpub(derivedNpub).then(setDeviceColor)
    } else {
      setDeviceColor('#404040')
    }
  }, [derivedNpub])

  async function loadCommonNostrKeys() {
    if (loadingCommonKeys || !account || !accountId) return

    setLoadingCommonKeys(true)
    try {
      const keys = await generateCommonNostrKeys(account)
      if (keys && 'commonNsec' in keys && 'commonNpub' in keys) {
        updateAccountNostr(accountId, {
          ...account.nostr,
          commonNsec: keys.commonNsec,
          commonNpub: keys.commonNpub,
          lastUpdated: new Date()
        })
      } else if (keys && 'externalDescriptor' in keys) {
        toast.error('Common keys are not available for watch-only accounts')
      }
    } catch (_error) {
      toast.error('Failed to generate common keys')
    } finally {
      setLoadingCommonKeys(false)
    }
  }

  useEffect(() => {
    if (
      account &&
      accountId &&
      account.nostr &&
      !account.nostr.commonNsec &&
      !account.nostr.commonNpub
    ) {
      loadCommonNostrKeys()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when accountId changes to avoid re-running on account ref change
  }, [accountId])

  async function pasteNsec() {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text?.trim()) {
        toast.error(t('common.error.noClipboardData'))
        return
      }
      setNsec(text.trim())
      toast.success(t('common.success.dataPasted'))
    } catch {
      toast.error(t('common.error.failedToPaste'))
    }
  }

  function saveChanges() {
    if (!accountId || !account?.nostr || !derivedNpub) return
    updateAccountNostr(accountId, {
      ...account.nostr,
      deviceNsec,
      deviceNpub: derivedNpub,
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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                      {commonNsecRevealed ? (
                        <>
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
                          <Pressable
                            onPress={() => setCommonNsecRevealed(false)}
                            style={styles.revealRow}
                          >
                            <SSIconEyeOn
                              stroke={Colors.white}
                              height={18}
                              width={18}
                            />
                            <SSText color="muted">
                              {t('account.nostrSync.hideNsec')}
                            </SSText>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          onPress={() => setCommonNsecRevealed(true)}
                          style={styles.revealRow}
                        >
                          <SSText
                            center
                            size="xl"
                            type="mono"
                            style={styles.keyText}
                          >
                            ••••••••••••••••
                          </SSText>
                          <SSIconEyeOff height={18} width={18} />
                        </Pressable>
                      )}
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
                  <SSHStack style={styles.keyContainerLoading} gap="sm">
                    <ActivityIndicator color={Colors.white} />
                    <SSText uppercase color="white">
                      {t('account.nostrSync.loadingKeys')}
                    </SSText>
                  </SSHStack>
                )}
              </SSVStack>
            </SSVStack>
            <SSVStack gap="sm">
              <SSText center>{t('account.nostrSync.deviceKeys')}</SSText>
              <SSVStack gap="xxs" style={styles.keysContainer}>
                <SSVStack gap="xxs">
                  <SSText color="muted" center>
                    {t('account.nostrSync.npub')}
                  </SSText>
                  {derivedNpub ? (
                    <SSHStack gap="xxs" style={styles.npubRow}>
                      <View
                        style={[
                          styles.deviceColorCircle,
                          { backgroundColor: deviceColor }
                        ]}
                      />
                      <SSTextClipboard text={derivedNpub}>
                        <SSText
                          center
                          size="xl"
                          type="mono"
                          style={styles.keyText}
                          selectable
                        >
                          {derivedNpub.slice(0, 12) +
                            '...' +
                            derivedNpub.slice(-4)}
                        </SSText>
                      </SSTextClipboard>
                    </SSHStack>
                  ) : (
                    <SSText center color="muted" style={styles.keyText}>
                      {t('account.nostrSync.npubPlaceholder')}
                    </SSText>
                  )}
                  {derivedNpub && (
                    <SSButton
                      variant="default"
                      label={t('common.showQR')}
                      onPress={() =>
                        setQrModal({ type: 'npub', value: derivedNpub })
                      }
                      style={styles.showQrButton}
                    />
                  )}
                </SSVStack>
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" center>
                  {t('account.nostrSync.nsec')}
                </SSText>
                {nsecRevealed ? (
                  <SSVStack
                    gap="xs"
                    style={[styles.nsecContainer, styles.nsecContainerExpanded]}
                  >
                    <SSTextInput
                      value={deviceNsec}
                      onChangeText={setNsec}
                      placeholder={t('account.nostrSync.nsec')}
                      style={[styles.input, styles.monoInput]}
                      multiline
                      numberOfLines={2}
                      textAlignVertical="top"
                    />
                    {deviceNsec && (
                      <SSButton
                        variant="default"
                        label={t('common.showQR')}
                        onPress={() =>
                          setQrModal({ type: 'nsec', value: deviceNsec })
                        }
                        style={styles.showQrButton}
                      />
                    )}
                    <Pressable
                      onPress={() => setNsecRevealed(false)}
                      style={styles.revealRow}
                    >
                      <SSIconEyeOn
                        stroke={Colors.white}
                        height={18}
                        width={18}
                      />
                      <SSText color="muted">
                        {t('account.nostrSync.hideNsec')}
                      </SSText>
                    </Pressable>
                    <SSHStack gap="md" style={styles.clearPasteRow}>
                      <SSButton
                        variant="danger"
                        label={t('common.clear')}
                        onPress={() => setNsec('')}
                        style={styles.clearPasteButton}
                      />
                      <SSButton
                        variant="secondary"
                        label={t('common.paste')}
                        onPress={pasteNsec}
                        style={styles.clearPasteButton}
                      />
                    </SSHStack>
                  </SSVStack>
                ) : (
                  <Pressable
                    onPress={() => setNsecRevealed(true)}
                    style={[styles.revealRow, styles.nsecContainer]}
                  >
                    <SSText center size="xl" type="mono" style={styles.keyText}>
                      ••••••••••••••••
                    </SSText>
                    <SSIconEyeOff height={18} width={18} />
                  </Pressable>
                )}
              </SSVStack>
            </SSVStack>
            <SSButton
              label={t('account.nostrSync.save')}
              onPress={saveChanges}
              disabled={!deviceNsec || !derivedNpub}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => router.back()}
              style={styles.cancelButton}
            />
          </SSVStack>
        </ScrollView>
      </SSVStack>
      <SSModal
        visible={qrModal !== null}
        fullOpacity
        onClose={() => setQrModal(null)}
        label={t('common.cancel')}
      >
        <SSVStack gap="lg" style={styles.qrModalContent}>
          {qrModal && (
            <>
              <SSText center uppercase>
                {qrModal.type === 'npub'
                  ? t('account.nostrSync.npub')
                  : t('account.nostrSync.nsec')}
              </SSText>
              <View style={styles.qrCodeWrapper}>
                <SSQRCode
                  value={qrModal.value}
                  size={220}
                  color={Colors.white}
                  backgroundColor={Colors.gray[950]}
                  ecl="H"
                />
              </View>
              <View style={styles.qrModalDataBox}>
                <SSText
                  type="mono"
                  size="sm"
                  selectable
                  style={styles.qrModalDataText}
                >
                  {qrModal.value}
                </SSText>
              </View>
            </>
          )}
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingTop: 10,
    paddingBottom: 20
  },
  pageContainer: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 24,
    flexGrow: 1
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
  },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  nsecContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    padding: 10,
    paddingHorizontal: 16
  },
  nsecContainerExpanded: {
    paddingTop: 16
  },
  clearPasteRow: {
    marginTop: 4,
    paddingBottom: 10,
    flexDirection: 'row',
    flexWrap: 'nowrap'
  },
  clearPasteButton: {
    flex: 1,
    minWidth: 0
  },
  cancelButton: {
    marginTop: 8
  },
  deviceColorCircle: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  npubRow: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  showQrButton: {
    marginTop: 20
  },
  qrModalContent: {
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  qrCodeWrapper: {
    padding: 16,
    backgroundColor: Colors.gray[950],
    borderRadius: 10
  },
  qrModalDataBox: {
    padding: 12,
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxWidth: '100%'
  },
  qrModalDataText: {
    textAlign: 'center'
  }
})

export default NostrKeys
