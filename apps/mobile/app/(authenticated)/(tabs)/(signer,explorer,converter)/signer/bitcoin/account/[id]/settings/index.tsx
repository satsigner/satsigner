import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconCircle, SSIconEyeOn } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSPinEntry from '@/components/SSPinEntry'
import SSSeedQR from '@/components/SSSeedQR'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTextInput, { SSTextInputProps } from '@/components/SSTextInput'
import { PIN_KEY, SALT_KEY } from '@/config/auth'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import {
  decryptAllAccountKeySecrets,
  getAccountFingerprint
} from '@/utils/account'
import { isElectrumDerivationPath } from '@/utils/bip39'
import { aesDecrypt, pbkdf2Encrypt } from '@/utils/crypto'
import { formatAccountCreationDate } from '@/utils/date'
import { emptyPin } from '@/utils/pin'
import { getScriptVersionDisplayName } from '@/utils/scripts'

export default function AccountSettings() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()
  const insets = useSafeAreaInsets()

  const [accounts, updateAccountName, deleteAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.updateAccountName,
      state.deleteAccount
    ])
  )
  const account = accounts.find((_account) => _account.id === currentAccountId)
  const removeAccountWallet = useWalletsStore(
    (state) => state.removeAccountWallet
  )

  const [scriptVersion, setScriptVersion] = useState<Key['scriptVersion']>(
    account?.keys[0]?.scriptVersion || 'P2WPKH'
  )
  const [network, setNetwork] = useState<NonNullable<string>>(
    account?.network || 'signet'
  )
  const [accountName, setAccountName] = useState<Account['name']>(
    account?.name || ''
  )
  const [isValidName, setIsValidName] = useState<SSTextInputProps['status']>('valid')
  const [localMnemonic, setLocalMnemonic] = useState('')
  const [decryptedKeys, setDecryptedKeys] = useState<Key[]>([])
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [mnemonicModalVisible, setMnemonicModalVisible] = useState(false)
  const [seedQRModalVisible, setSeedQRModalVisible] = useState(false)
  const [pin, setPin] = useState<string[]>(emptyPin)
  const [showPinEntry, setShowPinEntry] = useState(false)
  const [pinEntryFocus, setPinEntryFocus] = useState(false)

  const labels = account?.labels ? Object.values(account.labels) : []
  const labelCounts = {
    addresses: {
      labeled: labels.filter((l) => l.type === 'addr').length,
      total: account?.addresses?.length || 0
    },
    transactions: {
      labeled: labels.filter((l) => l.type === 'tx').length,
      total: account?.transactions?.length || 0
    },
    utxos: {
      labeled: labels.filter((l) => l.type === 'output').length,
      total: account?.utxos?.length || 0
    }
  }

  function validateName(name: string) {
    if (name === '') {
      setIsValidName(undefined)
      return
    }
    const invalid = accounts.some(
      (otherAccount) =>
        otherAccount.id !== currentAccountId &&
        otherAccount.name === name &&
        otherAccount.network === account?.network
    )
    setIsValidName(invalid ? 'invalid' : 'valid')
  }

  function handleSetAccountName(name: string) {
    validateName(name)
    setAccountName(name)
  }

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
    setShowPinEntry(true)
    setPin(emptyPin())

    // This will auto-focus the pin input after a little delay.
    // The delay is needed because the modal has to have become visible first.
    setTimeout(() => {
      setPinEntryFocus(true)
    }, 300)
  }

  function handleCloseMnemonicModal() {
    setShowPinEntry(false)
    setPin(emptyPin())
    setPinEntryFocus(false)
  }

  async function handlePinEntry(pinString: string) {
    const salt = await getItem(SALT_KEY)
    const storedEncryptedPin = await getItem(PIN_KEY)
    if (!salt || !storedEncryptedPin) {
      toast.error('Unable to decrypt PIN')
      return
    }

    const encryptedPin = await pbkdf2Encrypt(pinString, salt)
    const isPinValid = encryptedPin === storedEncryptedPin

    if (isPinValid) {
      setShowPinEntry(false)
      setMnemonicModalVisible(true)
      setTimeout(() => setPin(emptyPin()), 500)
    } else {
      setPin(emptyPin())
    }
  }

  function saveChanges() {
    updateAccountName(currentAccountId!, accountName)
    router.replace(`/signer/bitcoin/account/${currentAccountId}/`)
  }

  function deleteThisAccount() {
    deleteAccount(currentAccountId!)
    removeAccountWallet(currentAccountId!)
    router.replace('/signer/bitcoin/accountList')
  }

  useEffect(() => {
    async function getMnemonic() {
      const pin = await getItem(PIN_KEY)
      if (!account || !pin) {
        return
      }

      const stored = await getKeySecret(account.id, 0)
      if (!stored) {
        return
      }

      const accountSecretString = await aesDecrypt(
        stored.secret,
        pin,
        stored.iv
      )
      const accountSecret = JSON.parse(accountSecretString) as Secret

      setLocalMnemonic(accountSecret.mnemonic || '')
    }
    getMnemonic()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function decryptCurrentAccountKeys() {
      if (!account) {
        return
      }
      const secrets = await decryptAllAccountKeySecrets(account)
      const decryptedKeyData = account.keys.map((key, index) => {
        const newKey: Key = {
          ...key,
          secret: secrets[index]
        }
        return newKey
      })
      setDecryptedKeys(decryptedKeyData)
    }

    try {
      decryptCurrentAccountKeys()
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`Failed to decrypt account keys: ${reason}`)
    }
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

  if (!currentAccountId || !account || !scriptVersion) {
    return <Redirect href="/" />
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom }}>
      <Stack.Screen
        options={{
          headerRight: () => null,
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          )
        }}
      />
      <SSVStack gap="lg" style={styles.mainLayout}>
        <SSText center uppercase color="muted">
          {t('account.settings.title')}
        </SSText>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.name')} />
            <SSTextInput
              value={accountName}
              onChangeText={handleSetAccountName}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack gap="xs" style={styles.infoTable}>
          {account.policyType !== 'multisig' && (
            <SSHStack justifyBetween>
              <SSText color="muted">{t('account.fingerprint')}</SSText>
              <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                {getAccountFingerprint(account, decryptedKeys) && (
                  <SSIconCircle
                    size={10}
                    fill={`#${getAccountFingerprint(account, decryptedKeys)?.slice(0, 6)}`}
                  />
                )}
                <SSText>
                  {getAccountFingerprint(account, decryptedKeys) || '-'}
                </SSText>
              </SSHStack>
            </SSHStack>
          )}
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.createdOn')}</SSText>
            <SSText>
              {account?.createdAt
                ? formatAccountCreationDate(account.createdAt)
                : '-'}
            </SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.network.title')}</SSText>
            <SSText>{network}</SSText>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.policy.title')}</SSText>
            <SSText>{getPolicyTypeButtonLabel()}</SSText>
          </SSHStack>
          {account.policyType === 'singlesig' && (
            <SSHStack justifyBetween>
              <SSText color="muted">{t('account.script')}</SSText>
              <SSText>{getScriptVersionDisplayName(scriptVersion)}</SSText>
            </SSHStack>
          )}
          {account.policyType !== 'multisig' &&
            account.keys[0].derivationPath && (
              <SSHStack justifyBetween>
                <SSText color="muted">{t('account.derivationPath')}</SSText>
                <SSHStack gap="xs">
                  <SSText>{account.keys[0].derivationPath}</SSText>
                  {/^m(\/0[h'])?$/.test(account.keys[0].derivationPath) && (
                    <SSText style={{ color: Colors.warning }}>electrum</SSText>
                  )}
                </SSHStack>
              </SSHStack>
            )}
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.labeledTransactions')}</SSText>
            <SSHStack gap="xs">
              <SSText>{labelCounts.transactions.labeled}</SSText>
              <SSText color="muted">of</SSText>
              <SSText>{labelCounts.transactions.total}</SSText>
            </SSHStack>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.labeledUtxos')}</SSText>
            <SSHStack gap="xs">
              <SSText>{labelCounts.utxos.labeled}</SSText>
              <SSText color="muted">of</SSText>
              <SSText>{labelCounts.utxos.total}</SSText>
            </SSHStack>
          </SSHStack>
          <SSHStack justifyBetween>
            <SSText color="muted">{t('account.labeledAddresses')}</SSText>
            <SSHStack gap="xs">
              <SSText>{labelCounts.addresses.labeled}</SSText>
              <SSText color="muted">of</SSText>
              <SSText>{labelCounts.addresses.total}</SSText>
            </SSHStack>
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
                    key={key.fingerprint ?? index}
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
          <SSButton
            style={styles.button}
            label={t('account.nostrSync.sync')}
            variant="outline"
            onPress={() =>
              router.navigate(
                `/signer/bitcoin/account/${currentAccountId}/settings/nostr`
              )
            }
          />
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton
              style={styles.button}
              label={t('account.export.labels')}
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${currentAccountId}/settings/export/labels`
                )
              }
            />
            <SSButton
              style={styles.button}
              label={t('account.import.labels')}
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${currentAccountId}/settings/import/labels`
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
                  `/signer/bitcoin/account/${currentAccountId}/settings/export/descriptors`
                )
              }
            />
            <SSButton
              style={styles.button}
              label={t('account.export.pubkeys')}
              disabled={account.keys[0].creationType === 'importAddress'}
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${currentAccountId}/settings/export/pubkeys`
                )
              }
            />
          </SSHStack>
        </SSVStack>

        <SSVStack style={styles.actionsContainer}>
          <SSButton
            label={t('account.delete.title')}
            style={styles.deleteButton}
            onPress={() => setDeleteModalVisible(true)}
          />
          <SSButton
            label={t('common.save')}
            variant="secondary"
            disabled={isValidName !== 'valid'}
            onPress={saveChanges}
          />
        </SSVStack>
      </SSVStack>
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
                {t('account.mnemonic.title')} (
                {account.keys[0].mnemonicWordList?.replaceAll('_', ' ')})
              </SSText>
              <SSHStack style={{ justifyContent: 'center' }}>
                <SSText uppercase color="muted">
                  {t('account.seed.keepInSecret')}
                </SSText>
              </SSHStack>
              {isElectrumDerivationPath(
                account.keys[0]?.derivationPath || ''
              ) && (
                <View style={styles.electrumWarning}>
                  <SSText style={styles.electrumWarningText}>
                    {t('bitcoin.electrumSeedNote')}
                  </SSText>
                </View>
              )}
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
        mnemonicWordList={account.keys[0]?.mnemonicWordList}
        visible={seedQRModalVisible}
        title={account.name}
        onClose={() => {
          setSeedQRModalVisible(false)
          setMnemonicModalVisible(true)
        }}
      />
      <SSModal visible={showPinEntry} onClose={handleCloseMnemonicModal}>
        <SSPinEntry
          title={t('account.enter.pin')}
          pin={pin}
          setPin={setPin}
          onFillEnded={handlePinEntry}
          autoFocus={pinEntryFocus}
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
  copyButton: {
    borderColor: Colors.gray[700],
    borderWidth: 1,
    width: '100%'
  },
  copyButtonContainer: {
    padding: 12,
    paddingTop: 0,
    width: '100%'
  },
  deleteButton: {
    backgroundColor: Colors.error
  },
  deleteModalInnerContainer: {
    flexWrap: 'wrap'
  },
  deleteModalOuterContainer: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    padding: 0,
    width: '100%'
  },
  electrumWarning: {
    borderColor: Colors.warning,
    borderRadius: 5,
    borderWidth: 1,
    padding: 10
  },
  electrumWarningText: {
    color: Colors.warning
  },
  infoTable: {
    width: '100%'
  },
  mainLayout: {
    padding: 20
  },
  mnemonicColumn: {
    flex: 1,
    maxWidth: '32%'
  },
  mnemonicGrid: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    width: '100%'
  },
  mnemonicModalContainer: {
    flex: 0,
    padding: 0,
    width: '100%'
  },
  mnemonicModalOuterContainer: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%'
  },
  mnemonicWordContainer: {
    height: 48,
    marginBottom: 8
  },
  mnemonicWordInnerContainer: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 3
  },
  mnemonicWordsContainer: {
    marginBottom: 16,
    width: '100%'
  },
  multiSigContainer: {
    backgroundColor: '#131313',
    paddingHorizontal: 0
  },
  multiSigKeyControlCOntainer: {
    marginBottom: 50,
    marginHorizontal: 0
  },
  wordIndex: {
    lineHeight: 20,
    minWidth: 24,
    textAlign: 'center'
  },
  wordText: {
    flex: 1,
    lineHeight: 20,
    textAlign: 'left'
  }
})
