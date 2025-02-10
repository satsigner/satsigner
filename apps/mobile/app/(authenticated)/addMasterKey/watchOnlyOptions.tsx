import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { Colors } from '@/styles'
import {
  validateAddress,
  validateDerivationPath,
  validateDescriptor,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

const watchOnlyOptions = ['xpub', 'descriptor', 'address']

type WatchOnlyOption = (typeof watchOnlyOptions)[number]

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
  const name = useAccountBuilderStore(useShallow((state) => state.name))
  const [selectedOption, setSelectedOption] = useState<WatchOnlyOption>('xpub')
  const [modalOptionsVisible, setModalOptionsVisible] = useState(true)

  const [masterFingerprint, setMasterFingerprint] = useState('')
  const [derivationPath, setDerivationPath] = useState('')
  const [xpub, setXpub] = useState('')
  const [descriptor, setDescriptor] = useState('')
  const [address, setAddress] = useState('')

  const [validAddress, setValidAddress] = useState(true)
  const [validDescriptor, setValidDescriptor] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validDerivationPath, setValidDerivationPath] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)

  function updateAddress(address: string) {
    setValidAddress(!address || validateAddress(address))
    setAddress(address)
  }

  function updateMasterFingerprint(fingerprint: string) {
    setValidMasterFingerprint(!fingerprint || validateFingerprint(fingerprint))
    setMasterFingerprint(fingerprint)
  }

  function updateDerivationPath(path: string) {
    setValidDerivationPath(!path || validateDerivationPath(path))
    setDerivationPath(path)
  }

  function updateXpub(xpub: string) {
    setValidXpub(!xpub || validateExtendedKey(xpub))
    setXpub(xpub)
    if (xpub.match(/^x(pub|priv)/) && derivationPath === '') {
      setDerivationPath("M/44'/0/0")
    }
    if (xpub.match(/^y(pub|priv)/) && derivationPath === '') {
      setDerivationPath("M/49'/0/0")
    }
    if (xpub.match(/^z(pub|priv)/) && derivationPath === '') {
      setDerivationPath("M/84'/0/0")
    }
  }

  function updateDescriptor(descriptor: string) {
    setValidDescriptor(!descriptor || validateDescriptor(descriptor))
    setDescriptor(descriptor)
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (selectedOption === 'descriptor') {
      updateDescriptor(text)
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
        {!modalOptionsVisible && (
          <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
            <SSVStack gap="lg">
              <SSVStack gap="xs">
                <SSText center>{labels[selectedOption]}</SSText>
                {selectedOption === 'xpub' && (
                  <SSTextInput
                    value={xpub}
                    style={validXpub ? styles.valid : styles.invalid}
                    placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                    onChangeText={updateXpub}
                  />
                )}
                {selectedOption === 'descriptor' && (
                  <SSTextInput
                    value={descriptor}
                    style={validDescriptor ? styles.valid : styles.invalid}
                    placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                    onChangeText={updateDescriptor}
                  />
                )}
                {selectedOption === 'address' && (
                  <SSTextInput
                    value={address}
                    style={validAddress ? styles.valid : styles.invalid}
                    placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                    onChangeText={updateAddress}
                  />
                )}
              </SSVStack>
              {selectedOption === 'xpub' && (
                <SSVStack gap="xs">
                  <SSText center>MASTER FINGERPRINT (optional)</SSText>
                  <SSTextInput
                    value={masterFingerprint}
                    style={
                      validMasterFingerprint ? styles.valid : styles.invalid
                    }
                    onChangeText={updateMasterFingerprint}
                  />
                  <SSText center>DERIVATION PATH (optional)</SSText>
                  <SSTextInput
                    value={derivationPath}
                    style={validDerivationPath ? styles.valid : styles.invalid}
                    onChangeText={updateDerivationPath}
                  />
                </SSVStack>
              )}
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
            <SSButton
              label="CANCEL"
              variant="secondary"
              onPress={() => setModalOptionsVisible(true)}
            />
          </SSVStack>
        )}
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  invalid: {
    borderColor: Colors.error,
    borderWidth: 1
  },
  valid: {
    //
  }
})
