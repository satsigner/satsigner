import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSPinEntry from '@/components/SSPinEntry'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSeedQR from '@/components/SSSeedQR'
import SSSelectModal from '@/components/SSSelectModal'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { PIN_KEY, SALT_KEY } from '@/config/auth'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { extractAccountFingerprint } from '@/utils/account'
import { aesDecrypt, pbkdf2Encrypt } from '@/utils/crypto'
import { formatAccountCreationDate } from '@/utils/date'
import { getScriptVersionDisplayName } from '@/utils/scripts'

export default function AccountSettings() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountName, deleteAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.updateAccountName,
      state.deleteAccount
    ])
  )
  const removeAccountWallet = useWalletsStore(
    (state) => state.removeAccountWallet
  )

  const skipPin = useAuthStore((state) => state.skipPin)

  const [scriptVersion, setScriptVersion] = useState<Key['scriptVersion']>(
    account?.keys[0]?.scriptVersion || 'P2WPKH'
  )
  const [network, setNetwork] = useState<NonNullable<string>>(
    account?.network || 'signet'
  )
  const [accountName, setAccountName] = useState<Account['name']>(
    account?.name || ''
  )
  const [localMnemonic, setLocalMnemonic] = useState('')
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [networkModalVisible, setNetworkModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [mnemonicModalVisible, setMnemonicModalVisible] = useState(false)
  const [seedQRModalVisible, setSeedQRModalVisible] = useState(false)
  const [pin, setPin] = useState<string[]>(Array(4).fill(''))
  const [showPinEntry, setShowPinEntry] = useState(false)

  function getPolicyTypeButtonLabel() {
    switch (account?.policyType) {
      case 'singlesig':
        return t('account.policy.singleSignature.title')
      case 'multisig':
        return t('account.policy.multiSignature.title')
      case 'watchonly':
        return t('account.policy.watchOnly.title')
      default:
        return ''
    }
  }

  function handleOnViewMnemonic() {
    if (skipPin) {
      setMnemonicModalVisible(true)
    } else {
      setPin(Array(4).fill(''))
      setShowPinEntry(true)
    }
  }

  async function handlePinEntry(pinString: string) {
    const salt = await getItem(SALT_KEY)
    const storedEncryptedPin = await getItem(PIN_KEY)
    if (!salt || !storedEncryptedPin) return

    const encryptedPin = await pbkdf2Encrypt(pinString, salt)
    const isPinValid = encryptedPin === storedEncryptedPin

    if (isPinValid) {
      setShowPinEntry(false)
      setMnemonicModalVisible(true)
    }
  }

  async function saveChanges() {
    updateAccountName(currentAccountId!, accountName)
    router.replace(`/account/${currentAccountId}/`)
  }

  function deleteThisAccount() {
    deleteAccount(currentAccountId!)
    removeAccountWallet(currentAccountId!)
    router.replace('/accountList')
  }

  useEffect(() => {
    async function getMnemonic() {
      const pin = await getItem(PIN_KEY)
      if (!account || !pin) return

      const iv = account.keys[0].iv
      const encryptedSecret = account.keys[0].secret as string

      const accountSecretString = await aesDecrypt(encryptedSecret, pin, iv)
      const accountSecret = JSON.parse(accountSecretString) as Secret

      setLocalMnemonic(accountSecret.mnemonic || '')
    }
    getMnemonic()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function decryptKeys() {
      const pin = await getItem(PIN_KEY)
      if (!account || !pin) return

      try {
        const decryptedKeysData = await Promise.all(
          account.keys.map(async (key) => {
            if (typeof key.secret === 'string') {
              // Decrypt the key's secret
              const decryptedSecretString = await aesDecrypt(
                key.secret,
                pin,
                key.iv
              )
              const decryptedSecret = JSON.parse(
                decryptedSecretString
              ) as Secret

              return {
                ...key,
                secret: decryptedSecret
              }
            } else {
              return key
            }
          })
        )

        setDecryptedKeys(decryptedKeysData)
      } catch {
        toast.error('Failed to decrypt keys')
      }
    }
    decryptKeys()
  }, [account])

  // Update network when account changes
  useEffect(() => {
    if (account?.network) {
      setNetwork(account.network)
    }
  }, [account?.network])

  // Update script version when account changes
  useEffect(() => {
    const accountKeys = account?.keys
    const scriptVersion = accountKeys?.[0]?.scriptVersion
    if (scriptVersion) {
      setScriptVersion(scriptVersion)
    }
  }, [account?.keys])

  if (!currentAccountId || !account || !scriptVersion)
    return <Redirect href="/" />

  return (
    <ScrollView>
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
      <SSVStack gap="lg" style={styles.mainLayout}>
        <SSText center uppercase color="muted">
          {t('account.settings.title')}
        </SSText>
        <SSVStack itemsCenter gap="none">
          {account.policyType !== 'multisig' && (
            <SSHStack gap="sm">
              <SSText color="muted">{t('account.fingerprint')}</SSText>
              <SSText>
                {extractAccountFingerprint(account, decryptedKeys) || '-'}
              </SSText>
            </SSHStack>
          )}
          <SSHStack gap="sm">
            <SSText color="muted">{t('account.createdOn')}</SSText>
            {account && account.createdAt && (
              <SSText>{formatAccountCreationDate(account.createdAt)}</SSText>
            )}
          </SSHStack>
        </SSVStack>
        {account.policyType === 'multisig' && (
          <>
            <SSVStack gap="md" style={styles.multiSigContainer}>
              <SSText
                weight="light"
                style={{
                  alignSelf: 'center',
                  fontSize: 55,
                  textTransform: 'lowercase'
                }}
              >
                {account.keysRequired || 1} {t('common.of')}{' '}
                {account.keyCount || 1}
              </SSText>

              <SSSignatureRequiredDisplay
                requiredNumber={account.keysRequired || 1}
                totalNumber={account.keyCount || 1}
                collectedSignatures={[]}
              />
              <SSText center uppercase>
                {t('account.accountKeys')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none" style={styles.multiSigKeyControlCOntainer}>
              {decryptedKeys.length > 0 ? (
                decryptedKeys.map((key, index) => (
                  <SSMultisigKeyControl
                    key={index}
                    index={index}
                    keyCount={account.keyCount}
                    keyDetails={key}
                    isSettingsMode
                    accountId={currentAccountId}
                  />
                ))
              ) : (
                <SSText center color="muted">
                  Loading keys...
                </SSText>
              )}
            </SSVStack>
          </>
        )}

        <SSVStack>
          <SSHStack>
            <SSButton
              style={styles.button}
              label={t('account.export.labels')}
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/export/labels`
                )
              }
            />
            <SSButton
              style={styles.button}
              label={t('account.import.labels')}
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/import/labels`
                )
              }
            />
          </SSHStack>
        </SSVStack>
        <SSVStack>
          {(account.keys[0].creationType === 'generateMnemonic' ||
            account.keys[0].creationType === 'importMnemonic') &&
            account.policyType !== 'multisig' && (
              <SSHStack>
                <SSButton
                  style={styles.button}
                  label={t('account.viewMnemonic')}
                  onPress={() => handleOnViewMnemonic()}
                />
              </SSHStack>
            )}
          <SSHStack>
            <SSButton
              style={styles.button}
              label={t('account.export.descriptors')}
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/export/descriptors`
                )
              }
            />
            <SSButton
              style={styles.button}
              label={t('account.export.pubkeys')}
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/export/pubkeys`
                )
              }
            />
          </SSHStack>
          <SSButton
            style={styles.button}
            label={t('account.nostrSync.sync')}
            onPress={() =>
              router.navigate(`/account/${currentAccountId}/settings/nostr`)
            }
          />
        </SSVStack>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.name')} />
            <SSTextInput value={accountName} onChangeText={setAccountName} />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.network.title')} />
            <SSButton
              label={network}
              // onPress={() => setNetworkModalVisible(true)}
              withSelect
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.policy.title')} />
            <SSButton label={getPolicyTypeButtonLabel()} withSelect />
          </SSFormLayout.Item>
          {account.policyType === 'singlesig' && (
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.script')} />
              <SSButton
                label={getScriptVersionDisplayName(scriptVersion)}
                onPress={() => setScriptVersionModalVisible(true)}
                withSelect
              />
            </SSFormLayout.Item>
          )}
        </SSFormLayout>

        <SSVStack style={styles.actionsContainer}>
          <SSButton label={t('account.duplicate.title')} />
          <SSButton
            label={t('account.delete.title')}
            style={styles.deleteButton}
            onPress={() => setDeleteModalVisible(true)}
          />
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={saveChanges}
          />
        </SSVStack>
      </SSVStack>
      <SSScriptVersionModal
        visible={scriptVersionModalVisible}
        scriptVersion={scriptVersion}
        policyType={account?.policyType}
        onSelect={(scriptVersion) => {
          setScriptVersion(scriptVersion)
          setScriptVersionModalVisible(false)
        }}
        onCancel={() => setScriptVersionModalVisible(false)}
      />
      <SSSelectModal
        visible={networkModalVisible}
        title={t('account.network.title')}
        selectedText={network.toUpperCase()}
        selectedDescription={t('account.network.description', { network })}
        onSelect={() => setNetworkModalVisible(false)}
        onCancel={() => setNetworkModalVisible(false)}
      >
        <SSRadioButton
          label={t('bitcoin.network.mainnet')}
          selected={network === 'bitcoin'}
          onPress={() => setNetwork('bitcoin')}
        />
        <SSRadioButton
          label={t('bitcoin.network.signet')}
          selected={network === 'signet'}
          onPress={() => setNetwork('signet')}
        />
        <SSRadioButton
          label={t('bitcoin.network.testnet')}
          selected={network === 'testnet'}
          onPress={() => setNetwork('testnet')}
        />
      </SSSelectModal>
      <SSModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
      >
        <SSVStack style={styles.deleteModalOuterContainer}>
          <SSText uppercase>{t('common.areYouSure')}</SSText>
          <SSHStack style={styles.deleteModalInnerContainer}>
            <SSButton
              label={t('common.yes')}
              style={styles.deleteButton}
              onPress={() => {
                setDeleteModalVisible(false)
                setTimeout(() => {
                  deleteThisAccount()
                }, 0)
              }}
            />
            <SSButton
              label={t('common.no')}
              onPress={() => setDeleteModalVisible(false)}
            />
          </SSHStack>
        </SSVStack>
      </SSModal>
      <SSModal
        fullOpacity
        visible={mnemonicModalVisible}
        onClose={() => setMnemonicModalVisible(false)}
        closeButtonVariant="ghost"
        label={t('common.close')}
      >
        {localMnemonic && (
          <View style={styles.mnemonicModalOuterContainer}>
            <SSVStack gap="lg" style={styles.mnemonicModalContainer}>
              <SSText center uppercase>
                {account.name}
              </SSText>
              <SSText center uppercase>
                {account.keys[0].mnemonicWordCount}{' '}
                {t('account.mnemonic.title')}
              </SSText>
              <SSHStack style={{ justifyContent: 'center' }}>
                <SSText uppercase color="muted">
                  {t('account.seed.keepInSecret')}
                </SSText>
              </SSHStack>
              <View style={styles.mnemonicWordsContainer}>
                {account.keys[0].mnemonicWordCount && (
                  <SSSeedLayout count={account.keys[0].mnemonicWordCount}>
                    <View style={styles.mnemonicGrid}>
                      {Array.from({ length: 3 }).map((_, colIndex) => {
                        // Calculate rows needed based on total words
                        // For 12 words: 4 rows per column
                        // For 20 words: 7 rows per column
                        // For 22 words: 8 rows per column
                        // For 24 words: 8 rows per column
                        const totalWords = account.keys[0].mnemonicWordCount!
                        const wordsPerColumn = Math.ceil(totalWords / 3)
                        const isLastColumn = colIndex === 2
                        const wordsInThisColumn = isLastColumn
                          ? totalWords - wordsPerColumn * 2 // Handle remainder in last column
                          : wordsPerColumn

                        return (
                          <View key={colIndex} style={styles.mnemonicColumn}>
                            {Array.from({ length: wordsPerColumn }).map(
                              (_, rowIndex) => {
                                const wordIndex =
                                  colIndex * wordsPerColumn + rowIndex
                                const words = localMnemonic.split(' ')
                                const word =
                                  wordIndex < words.length &&
                                  rowIndex < wordsInThisColumn
                                    ? words[wordIndex]
                                    : null

                                return word ? (
                                  <View
                                    key={rowIndex}
                                    style={styles.mnemonicWordContainer}
                                  >
                                    <SSHStack
                                      style={styles.mnemonicWordInnerContainer}
                                      gap="sm"
                                    >
                                      <SSText
                                        size="sm"
                                        color="muted"
                                        style={styles.wordIndex}
                                      >
                                        {(wordIndex + 1)
                                          .toString()
                                          .padStart(2, '0')}
                                      </SSText>
                                      <SSText size="md" style={styles.wordText}>
                                        {word}
                                      </SSText>
                                    </SSHStack>
                                  </View>
                                ) : null
                              }
                            )}
                          </View>
                        )
                      })}
                    </View>
                  </SSSeedLayout>
                )}
              </View>
            </SSVStack>
            <View style={styles.copyButtonContainer}>
              <SSVStack gap="sm">
                <SSClipboardCopy text={localMnemonic.replaceAll(',', ' ')}>
                  <SSButton
                    label={t('common.copy')}
                    style={styles.copyButton}
                    variant="outline"
                  />
                </SSClipboardCopy>
                <SSButton
                  label={t('account.seed.showQR')}
                  style={styles.copyButton}
                  variant="outline"
                  onPress={() => {
                    setMnemonicModalVisible(false)
                    setSeedQRModalVisible(true)
                  }}
                />
              </SSVStack>
            </View>
          </View>
        )}
        {!localMnemonic && <SSText>{t('account.seed.unableToDecrypt')}</SSText>}
      </SSModal>
      <SSSeedQR
        mnemonic={localMnemonic}
        visible={seedQRModalVisible}
        title={account.name}
        onClose={() => {
          setSeedQRModalVisible(false)
          setMnemonicModalVisible(true)
        }}
      />
      <SSModal visible={showPinEntry} onClose={() => setShowPinEntry(false)}>
        <SSPinEntry
          title={t('account.enter.pin')}
          pin={pin}
          setPin={setPin}
          onFillEnded={handlePinEntry}
        />
      </SSModal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  actionsContainer: {
    marginTop: 60
  },
  button: {
    flex: 1
  },
  deleteButton: {
    backgroundColor: Colors.error
  },
  deleteModalInnerContainer: {
    flexWrap: 'wrap'
  },
  deleteModalOuterContainer: {
    padding: 0,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mainLayout: {
    padding: 20
  },
  multiSigContainer: {
    backgroundColor: '#131313',
    paddingHorizontal: 0
  },
  multiSigKeyControlCOntainer: {
    marginHorizontal: 0,
    marginBottom: 50
  },
  mnemonicGrid: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 8
  },
  mnemonicColumn: {
    flex: 1,
    maxWidth: '32%'
  },
  mnemonicWordContainer: {
    marginBottom: 8,
    height: 48
  },
  mnemonicWordInnerContainer: {
    flex: 1,
    padding: 3,
    borderRadius: 8,
    borderColor: Colors.gray[800],
    borderWidth: 1,
    backgroundColor: Colors.gray[900],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  wordIndex: {
    minWidth: 24,
    textAlign: 'center',
    lineHeight: 20
  },
  wordText: {
    flex: 1,
    textAlign: 'left',
    lineHeight: 20
  },
  mnemonicModalOuterContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between'
  },
  mnemonicModalContainer: {
    width: '100%',
    padding: 0,
    flex: 0
  },
  mnemonicWordsContainer: {
    width: '100%',
    marginBottom: 16
  },
  copyButtonContainer: {
    width: '100%',
    padding: 12,
    paddingTop: 0
  },
  copyButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.gray[700]
  }
})
