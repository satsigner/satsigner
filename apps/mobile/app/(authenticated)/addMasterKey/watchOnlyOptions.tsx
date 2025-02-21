import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { Keyboard, ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
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

const labels: Record<WatchOnlyOption, string> = {
  xpub: 'XPUB / YPUB / ZPUB',
  descriptor: 'DESCRIPTOR',
  address: 'Address'
}

const title: Record<WatchOnlyOption, string> = {
  xpub: 'Extended Public Key',
  descriptor: 'Descriptor',
  address: 'Address'
}

const text: Record<WatchOnlyOption, string> = {
  xpub: 'An extended public key is a type of key used in Bitcoin that allows for the generation of multiple public addresses from a single key. It is part of the hierarchical deterministic (HD) wallet structure defined by BIP32. An xpub can generate child public keys, which can be used to receive funds without exposing the corresponding private keys. This feature is useful for managing multiple addresses while maintaining privacy and security, as users can receive payments at different addresses without needing to create new wallets or expose sensitive information.',
  descriptor:
    'A Bitcoin descriptor is a flexible and expressive way to describe how Bitcoin addresses and keys are derived and used within a wallet. Introduced in BIP 174, descriptors allow users to specify the structure of their wallets in a more human-readable format. They can represent various types of addresses, including standard pay-to-public-key-hash (P2PKH), pay-to-script-hash (P2SH), and more complex constructions such as multisig. Descriptors improve wallet interoperability and make it easier for software to understand how to derive keys and addresses based on user-defined rules.',
  address: 'A single bitcoin address'
}

export default function WatchOnlyOptions() {
  const addSyncAccount = useAccountsStore((state) => state.addSyncAccount)
  const [
    name,
    scriptVersion,
    fingerprint,
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
    if (validFingerprint) {
      Keyboard.dismiss()
      setFingerprint(fingerprint)
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub)
    setValidXpub(!xpub || validXpub)
    setDisabled(!validXpub)
    setXpub(xpub)
    if (validXpub) setDescriptorFromXpub(xpub)
    if (xpub.match(/^x(pub|priv)/)) setScriptVersion('P2PKH')
    if (xpub.match(/^y(pub|priv)/)) setScriptVersion('P2SH-P2WPKH')
    if (xpub.match(/^z(pub|priv)/)) setScriptVersion('P2WPKH')
  }

  function updateExternalDescriptor(descriptor: string) {
    const validExternalDescriptor = validateDescriptor(descriptor)
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
        await addSyncAccount(account)
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
          title="WATCH-ONLY WALLET"
          selectedText={title[selectedOption]}
          selectedDescription={
            <SSCollapsible>
              <SSText color="muted" size="md">
                {text[selectedOption]}
              </SSText>
            </SSCollapsible>
          }
          onSelect={() => setModalOptionsVisible(false)}
          onCancel={() => router.back()}
        >
          {watchOnlyOptions.map((type) => (
            <SSRadioButton
              key={type}
              label={labels[type]}
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
                  <SSText center>{labels[selectedOption]}</SSText>
                  {selectedOption === 'xpub' && (
                    <SSTextInput
                      value={xpub}
                      style={validXpub ? styles.valid : styles.invalid}
                      placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                      onChangeText={updateXpub}
                      multiline
                    />
                  )}
                  {selectedOption === 'descriptor' && (
                    <SSTextInput
                      value={externalDescriptor}
                      style={validExternalDescriptor ? styles.valid : styles.invalid}
                      placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                      onChangeText={updateExternalDescriptor}
                      multiline
                    />
                  )}
                  {selectedOption === 'address' && (
                    <SSTextInput
                      value={address}
                      style={validAddress ? styles.valid : styles.invalid}
                      placeholder={`ENTER ${selectedOption.toUpperCase()}`}
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
                      <SSText center>MASTER FINGERPRINT</SSText>
                      <SSTextInput
                        value={fingerprint}
                        style={
                          validMasterFingerprint ? styles.valid : styles.invalid
                        }
                        placeholder="ENTER FINGERPRINT"
                        onChangeText={updateMasterFingerprint}
                      />
                    </SSVStack>
                  </>
                )}
                {selectedOption === 'descriptor' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSText center>INTERNAL DESCRIPTOR (optional)</SSText>
                      <SSTextInput
                        value={internalDescriptor}
                        style={
                          validInternalDescriptor
                            ? styles.valid
                            : styles.invalid
                        }
                        multiline
                        onChangeText={updateInternalDescriptor}
                        placeholder="ENTER DESCRIPTOR"
                      />
                    </SSVStack>
                  </>
                )}
              </SSVStack>

              <SSVStack>
                <SSButton
                  label="PASTE FROM CLIPBOARD"
                  onPress={pasteFromClipboard}
                />
                <SSButton label="SCAN QRCODE" disabled />
                <SSButton label="TAP NFC" disabled />
                <SSButton label="COMPUTER VISION TEXT" disabled />
              </SSVStack>
            </SSVStack>
            <SSVStack gap="sm">
              <SSButton
                label="CONFIRM"
                variant="secondary"
                loading={loadingWallet}
                disabled={disabled}
                onPress={() => confirmAccountCreation()}
              />
              <SSButton
                label="CANCEL"
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
