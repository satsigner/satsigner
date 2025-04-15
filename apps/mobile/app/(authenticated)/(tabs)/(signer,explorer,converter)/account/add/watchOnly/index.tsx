import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Keyboard, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type CreationType } from '@/types/models/Account'
import {
  validateAddress,
  validateDescriptor,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

const watchOnlyOptions: CreationType[] = [
  'importExtendedPub',
  'importDescriptor',
  'importAddress'
]

export default function WatchOnly() {
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const [
    name,
    scriptVersion,
    fingerprint,
    setCreationType,
    clearAccount,
    getAccountData,
    setFingerprint,
    setExternalDescriptor,
    setInternalDescriptor,
    setExtendedPublicKey,
    setScriptVersion,
    setKey
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.fingerprint,
      state.setCreationType,
      state.clearAccount,
      state.getAccountData,
      state.setFingerprint,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setExtendedPublicKey,
      state.setScriptVersion,
      state.setKey
    ])
  )
  const connectionMode = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork].param.connectionMode
  )
  const { accountBuilderFinish } = useAccountBuilderFinish()
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()

  const [selectedOption, setSelectedOption] =
    useState<CreationType>('importExtendedPub')

  const [modalOptionsVisible, setModalOptionsVisible] = useState(true)
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState(fingerprint)
  const [externalDescriptor, setLocalExternalDescriptor] = useState('')
  const [internalDescriptor, setLocalInternalDescriptor] = useState('')
  const [address, setAddress] = useState('')

  const [disabled, setDisabled] = useState(true)
  const [validAddress, setValidAddress] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)

  const [loadingWallet, setLoadingWallet] = useState(false)

  function updateAddress(address: string) {
    const validAddress = validateAddress(address)
    setValidAddress(!address || validAddress)
    setDisabled(!validAddress)
    setAddress(address)
  }

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validFingerprint)
    setDisabled(!validXpub || !validFingerprint)
    setLocalFingerprint(fingerprint)
    if (validFingerprint) {
      setFingerprint(fingerprint)
      Keyboard.dismiss()
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub)
    setValidXpub(!xpub || validXpub)
    setDisabled(!validXpub || !localFingerprint)
    setXpub(xpub)
    if (xpub.match(/^x(pub|priv)/)) setScriptVersion('P2PKH')
    if (xpub.match(/^y(pub|priv)/)) setScriptVersion('P2SH-P2WPKH')
    if (xpub.match(/^z(pub|priv)/)) setScriptVersion('P2WPKH')
  }

  function updateExternalDescriptor(descriptor: string) {
    const validExternalDescriptor =
      validateDescriptor(descriptor) && !descriptor.match(/[txyz]priv/)
    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setDisabled(!validExternalDescriptor)
    setLocalExternalDescriptor(descriptor)
    if (validExternalDescriptor) setExternalDescriptor(descriptor)
  }

  function updateInternalDescriptor(descriptor: string) {
    const validInternalDescriptor = validateDescriptor(descriptor)
    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setDisabled(!validInternalDescriptor)
    setLocalInternalDescriptor(descriptor)
    if (validInternalDescriptor) setInternalDescriptor(descriptor)
  }

  async function confirmAccountCreation() {
    setLoadingWallet(true)
    if (selectedOption === 'importExtendedPub') setExtendedPublicKey(xpub)
    else if (selectedOption === 'importAddress')
      setExternalDescriptor(`addr(${address})`)

    setKey(0)
    const account = getAccountData()

    const data = await accountBuilderFinish(account)
    if (!data) return

    try {
      if (connectionMode === 'auto') {
        const updatedAccount =
          selectedOption !== 'importAddress'
            ? await syncAccountWithWallet(
                data.accountWithEncryptedSecret,
                data.wallet!
              )
            : await syncAccountWithAddress(
                data.accountWithEncryptedSecret,
                `addr(${address})`
              )
        updateAccount(updatedAccount)
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      clearAccount()
      setLoadingWallet(false)
    }

    router.navigate('/')
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return

    if (selectedOption === 'importDescriptor') {
      let externalDescriptor = text
      let internalDescriptor = ''
      if (text.match(/<0[,;]1>/)) {
        externalDescriptor = text
          .replace(/<0[,;]1>/, '0')
          .replace(/#[a-z0-9]+$/, '')
        internalDescriptor = text
          .replace(/<0[,;]1>/, '1')
          .replace(/#[a-z0-9]+$/, '')
      }
      if (text.includes('\n')) {
        const lines = text.split('\n')
        externalDescriptor = lines[0]
        internalDescriptor = lines[1]
      }
      if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
      if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
    }

    if (selectedOption === 'importExtendedPub') {
      updateXpub(text)
    }

    if (selectedOption === 'importAddress') {
      updateAddress(text)
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSSelectModal
          visible={modalOptionsVisible}
          title={t('watchonly.titleModal').toUpperCase()}
          selectedText={t(`watchonly.${selectedOption}.title`)}
          selectedDescription={
            <SSCollapsible>
              <SSText color="muted" size="md">
                {t(`watchonly.${selectedOption}.text`)}
              </SSText>
            </SSCollapsible>
          }
          onSelect={() => {
            setModalOptionsVisible(false)
            setCreationType(selectedOption)
          }}
          onCancel={() => router.back()}
        >
          {watchOnlyOptions.map((type) => (
            <SSRadioButton
              key={type}
              label={t(`watchonly.${type}.label`)}
              selected={selectedOption === type}
              onPress={() => setSelectedOption(type)}
            />
          ))}
        </SSSelectModal>
        <SSScriptVersionModal
          visible={scriptVersionModalVisible}
          scriptVersion={scriptVersion}
          onCancel={() => setScriptVersionModalVisible(false)}
          onSelect={(scriptVersion) => {
            setScriptVersion(scriptVersion)
            setScriptVersionModalVisible(false)
          }}
        />
        {!modalOptionsVisible && (
          <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSVStack gap="xxs">
                  <SSText center>
                    {t(`watchonly.${selectedOption}.label`)}
                  </SSText>
                  {selectedOption === 'importExtendedPub' && (
                    <SSTextInput
                      value={xpub}
                      style={validXpub ? styles.valid : styles.invalid}
                      onChangeText={updateXpub}
                      multiline
                    />
                  )}
                  {selectedOption === 'importDescriptor' && (
                    <SSTextInput
                      value={externalDescriptor}
                      style={
                        validExternalDescriptor ? styles.valid : styles.invalid
                      }
                      onChangeText={updateExternalDescriptor}
                      multiline
                    />
                  )}
                  {selectedOption === 'importAddress' && (
                    <SSTextInput
                      value={address}
                      style={validAddress ? styles.valid : styles.invalid}
                      onChangeText={updateAddress}
                      multiline
                    />
                  )}
                </SSVStack>
                {selectedOption === 'importExtendedPub' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSFormLayout.Label
                        label={t('account.script').toUpperCase()}
                      />
                      <SSButton
                        label={`${t(`script.${scriptVersion.toLocaleLowerCase()}.name`)} (${scriptVersion})`}
                        withSelect
                        onPress={() => setScriptVersionModalVisible(true)}
                      />
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText center>{t('watchonly.fingerprint.label')}</SSText>
                      <SSTextInput
                        value={localFingerprint}
                        onChangeText={updateMasterFingerprint}
                        style={
                          validMasterFingerprint ? styles.valid : styles.invalid
                        }
                      />
                    </SSVStack>
                  </>
                )}
                {selectedOption === 'importDescriptor' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSText center>
                        {t('watchonly.importDescriptor.internal')}
                      </SSText>
                      <SSTextInput
                        value={internalDescriptor}
                        style={
                          validInternalDescriptor
                            ? styles.valid
                            : styles.invalid
                        }
                        multiline
                        onChangeText={updateInternalDescriptor}
                      />
                    </SSVStack>
                  </>
                )}
              </SSVStack>
              <SSVStack>
                <SSButton
                  label={t('watchonly.read.clipboard')}
                  onPress={pasteFromClipboard}
                />
                <SSButton label={t('watchonly.read.qrcode')} disabled />
                <SSButton label={t('watchonly.read.nfc')} disabled />
                <SSButton label={t('watchonly.read.computerVision')} disabled />
              </SSVStack>
            </SSVStack>
            <SSVStack gap="sm">
              <SSButton
                label={t('common.confirm')}
                variant="secondary"
                loading={loadingWallet}
                disabled={disabled}
                onPress={() => confirmAccountCreation()}
              />
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => setModalOptionsVisible(true)}
              />
            </SSVStack>
          </SSVStack>
        )}
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  invalid: {
    borderColor: Colors.error,
    borderWidth: 1,
    height: 'auto',
    paddingVertical: 10
  },
  valid: {
    height: 'auto',
    paddingVertical: 10
  }
})
