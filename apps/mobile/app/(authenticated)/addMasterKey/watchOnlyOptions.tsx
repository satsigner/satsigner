import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Keyboard, ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import {
  validateAddress,
  validateDescriptor,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

type WatchOnlyOption = 'xpub' | 'descriptor' | 'address'
const watchOnlyOptions: WatchOnlyOption[] = ['xpub', 'descriptor', 'address']

export default function WatchOnlyOptions() {
  const addAccount = useAccountsStore((state) => state.addAccount)
  const [
    name,
    scriptVersion,
    fingerprint,
    clearAccount,
    getAccountFromDescriptor,
    setFingerprint,
    setDescriptorFromXpub,
    setDescriptorFromAddress,
    setExternalDescriptor,
    setInternalDescriptor,
    setScriptVersion
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.fingerprint,
      state.clearAccount,
      state.getAccountFromDescriptor,
      state.setFingerprint,
      state.setDescriptorFromXpub,
      state.setDescriptorFromAddress,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setScriptVersion
    ])
  )

  const [selectedOption, setSelectedOption] = useState<WatchOnlyOption>('xpub')

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
    if (validAddress) setDescriptorFromAddress(address)
  }

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validFingerprint)
    setDisabled(!validFingerprint)
    setLocalFingerprint(fingerprint)
    if (validFingerprint) {
      setFingerprint(fingerprint)
      Keyboard.dismiss()
      // force update xpub again because it depends upon the fingerprint
      if (selectedOption === 'xpub' && validXpub) setDescriptorFromXpub(xpub)
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub)
    setValidXpub(!xpub || validXpub)
    setDisabled(!validXpub)
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
    const account = await getAccountFromDescriptor()

    try {
      if (account) {
        await addAccount(account)
        clearAccount()
        router.navigate('/')
      }
    } finally {
      setLoadingWallet(false)
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return

    if (selectedOption === 'descriptor') {
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

    if (selectedOption === 'xpub') {
      updateXpub(text)
    }

    if (selectedOption === 'address') {
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
          title={t('watch-only.titleModal').toUpperCase()}
          selectedText={t(`watch-only.${selectedOption}.title`)}
          selectedDescription={
            <SSCollapsible>
              <SSText color="muted" size="md">
                {t(`watch-only.${selectedOption}Text`)}
              </SSText>
            </SSCollapsible>
          }
          onSelect={() => setModalOptionsVisible(false)}
          onCancel={() => router.back()}
        >
          {watchOnlyOptions.map((type) => (
            <SSRadioButton
              key={type}
              label={t(`watch-only.${type}.label`)}
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
                    {t(`watch-only.${selectedOption}.label`)}
                  </SSText>
                  {selectedOption === 'xpub' && (
                    <SSTextInput
                      value={xpub}
                      style={validXpub ? styles.valid : styles.invalid}
                      placeholder={t('watch-only.inputPlaceholder', {
                        option: t('watch-only.xpub.label')
                      }).toUpperCase()}
                      onChangeText={updateXpub}
                      multiline
                    />
                  )}
                  {selectedOption === 'descriptor' && (
                    <SSTextInput
                      value={externalDescriptor}
                      style={
                        validExternalDescriptor ? styles.valid : styles.invalid
                      }
                      placeholder={t('watch-only.inputPlaceholder', {
                        option: t('watch-only.descriptor.label')
                      }).toUpperCase()}
                      onChangeText={updateExternalDescriptor}
                      multiline
                    />
                  )}
                  {selectedOption === 'address' && (
                    <SSTextInput
                      value={address}
                      style={validAddress ? styles.valid : styles.invalid}
                      placeholder={t('watch-only.inputPlaceholder', {
                        option: t('watch-only.address.label')
                      }).toUpperCase()}
                      onChangeText={updateAddress}
                      multiline
                    />
                  )}
                </SSVStack>
                {selectedOption === 'xpub' && (
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
                      <SSText center>
                        {t('watch-only.fingerprint.label')}
                      </SSText>
                      <SSTextInput
                        value={localFingerprint}
                        onChangeText={updateMasterFingerprint}
                        style={
                          validMasterFingerprint ? styles.valid : styles.invalid
                        }
                        placeholder={t('watch-only.inputPlaceholder', {
                          option: t('watch-only.fingerprint.text')
                        }).toUpperCase()}
                      />
                    </SSVStack>
                  </>
                )}
                {selectedOption === 'descriptor' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSText center>
                        {t('watch-only.descriptor.internal')}
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
                        placeholder={t('watch-only.inputPlaceholder', {
                          option: t('common.descriptor')
                        }).toUpperCase()}
                      />
                    </SSVStack>
                  </>
                )}
              </SSVStack>

              {selectedOption === 'address' && (
                <SSVStack gap="xs">
                  <SSHStack>
                    <SSIconWarning height={16} width={16} />
                    <SSText center style={{ width: '80%' }}>
                      {t('watch-only.addressWarning')}
                    </SSText>
                    <SSIconWarning height={16} width={16} />
                  </SSHStack>
                  <SSText
                    size="xs"
                    center
                    onPress={() => router.navigate('/settings/network')}
                    style={{
                      textDecorationStyle: 'solid',
                      textDecorationLine: 'underline'
                    }}
                  >
                    {t('watch-only.addressWarningCallToAction')}
                  </SSText>
                </SSVStack>
              )}

              <SSVStack>
                <SSButton
                  label={t('watch-only.read.clipboard')}
                  onPress={pasteFromClipboard}
                />
                <SSButton label={t('watch-only.read.qrcode')} disabled />
                <SSButton label={t('watch-only.read.nfc')} disabled />
                <SSButton
                  label={t('watch-only.read.computerVision')}
                  disabled
                />
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
                variant="secondary"
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
