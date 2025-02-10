import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { Fragment, useState } from 'react'
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
import { i18n } from '@/locales'
import { Account } from '@/types/models/Account'
import SSLink from '@/components/SSLink'
import { SSIconScriptsP2pkh } from '@/components/icons'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import SSFormLayout from '@/layouts/SSFormLayout'

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

  const [scriptVersion, setScriptVersion] =
    useState<Account['scriptVersion'] | null>(null)

  const [modalOptionsVisible, setModalOptionsVisible] = useState(true)
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

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
    if (xpub.match(/^x(pub|priv)/)) {
      if (!derivationPath) setDerivationPath("M/44'/0'/0'")
      if (!scriptVersion) setScriptVersion('P2PKH')
    }
    if (xpub.match(/^y(pub|priv)/)) {
      if (!derivationPath) setDerivationPath("M/49'/0'/0'")
      if (!scriptVersion) setScriptVersion('P2SH-P2WPKH')
    }
    if (xpub.match(/^z(pub|priv)/) && derivationPath === '') {
      if (!derivationPath) setDerivationPath("M/84'/0'/0'")
      if (!scriptVersion) setScriptVersion('P2WPKH')
    }
  }

  function updateDescriptor(descriptor: string) {
    setValidDescriptor(!descriptor || validateDescriptor(descriptor))
    setDescriptor(descriptor)
  }

  function getScriptVersionButtonLabel() {
    if (scriptVersion === 'P2PKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2pkh')} (P2PKH)`
    else if (scriptVersion === 'P2SH-P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh')} (P2SH-P2WPKH)`
    else if (scriptVersion === 'P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2wpkh')} (P2WPKH)`
    else if (scriptVersion === 'P2TR')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2tr')} (P2TR)`
    return ''
  }

  function confirmAccountCreation() {
    let accountDescriptor = ''
    let accountScriptVersion: Account['scriptVersion'] | null

    if (selectedOption === 'descriptor' && descriptor) {
      accountDescriptor = descriptor
    }

    if (selectedOption === 'address' && address) {
      accountDescriptor = `addr(${address})`
    }

    if (selectedOption === 'xpub' && xpub) {
      let prefix = ''
      if (scriptVersion === 'P2TR') prefix = 'tr'
      if (scriptVersion === 'P2PKH') prefix = 'pkh'
      if (scriptVersion === 'P2WPKH') prefix = 'wpkh'
      if (scriptVersion === 'P2SH-P2WPKH') prefix = 'wsh'
      let derivationInfo = ''
      if (masterFingerprint && derivationPath) {
        const rawPath = derivationPath.replace(/^[mM]\//, "")
        derivationInfo = `[${masterFingerprint}/${rawPath}]`
      }
      accountDescriptor = `${prefix}(${derivationInfo}${xpub})`
    }

    if (descriptor.startsWith('pkh')) accountScriptVersion = 'P2PKH'
    if (descriptor.startsWith('wsh')) accountScriptVersion = 'P2SH-P2WPKH'
    if (descriptor.startsWith('wpk')) accountScriptVersion = 'P2WPKH'
    if (descriptor.startsWith('tr')) accountScriptVersion = 'P2TR'

    // TODO: create account
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

        <SSSelectModal
          visible={scriptVersionModalVisible}
          title={i18n.t('addMasterKey.accountOptions.scriptVersion')}
          selectedText={`${scriptVersion} - ${i18n.t(
            `addMasterKey.accountOptions.scriptVersions.names.${scriptVersion?.toLowerCase()}`
          )}`}
          selectedDescription={
            <SSCollapsible>
              <SSText color="muted" size="md">
                {i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.descriptions.${scriptVersion?.toLowerCase()}.0`
                )}
                <SSLink
                  size="md"
                  text={i18n.t(
                    `addMasterKey.accountOptions.scriptVersions.links.name.${scriptVersion?.toLowerCase()}`
                  )}
                  url={i18n.t(
                    `addMasterKey.accountOptions.scriptVersions.links.url.${scriptVersion?.toLowerCase()}`
                  )}
                />
                {i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.descriptions.${scriptVersion?.toLowerCase()}.1`
                )}
              </SSText>
              <SSIconScriptsP2pkh height={80} width="100%" />
            </SSCollapsible>
          }
          onSelect={() => setScriptVersionModalVisible(false)}
          onCancel={() => setScriptVersionModalVisible(false)}
        >
          <SSRadioButton
            label={`${i18n.t(
              'addMasterKey.accountOptions.scriptVersions.names.p2pkh'
            )} (P2PKH)`}
            selected={scriptVersion === 'P2PKH'}
            onPress={() =>
              setStateWithLayoutAnimation(setScriptVersion, 'P2PKH')
            }
          />
          <SSRadioButton
            label={`${i18n.t(
              'addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh'
            )} (P2SH-P2WPKH)`}
            selected={scriptVersion === 'P2SH-P2WPKH'}
            onPress={() =>
              setStateWithLayoutAnimation(setScriptVersion, 'P2SH-P2WPKH')
            }
          />
          <SSRadioButton
            label={`${i18n.t(
              'addMasterKey.accountOptions.scriptVersions.names.p2wpkh'
            )} (P2WPKH)`}
            selected={scriptVersion === 'P2WPKH'}
            onPress={() =>
              setStateWithLayoutAnimation(setScriptVersion, 'P2WPKH')
            }
          />
          <SSRadioButton
            label={`${i18n.t(
              'addMasterKey.accountOptions.scriptVersions.names.p2tr'
            )} (P2TR)`}
            selected={scriptVersion === 'P2TR'}
            onPress={() =>
              setStateWithLayoutAnimation(setScriptVersion, 'P2TR')
            }
          />
        </SSSelectModal>
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
                  <Fragment>
                    <SSVStack gap="xxs">
                      <SSFormLayout.Label
                        label={i18n
                          .t('addMasterKey.accountOptions.scriptVersion')
                          .toUpperCase()}
                      />
                      <SSButton
                        label={getScriptVersionButtonLabel()}
                        withSelect
                        onPress={() => setScriptVersionModalVisible(true)}
                      />
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText center>MASTER FINGERPRINT (optional)</SSText>
                      <SSTextInput
                        value={masterFingerprint}
                        style={
                          validMasterFingerprint ? styles.valid : styles.invalid
                        }
                        placeholder="ENTER FINGERPRINT"
                        onChangeText={updateMasterFingerprint}
                      />
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText center>DERIVATION PATH (optional)</SSText>
                      <SSTextInput
                        value={derivationPath}
                        style={
                          validDerivationPath ? styles.valid : styles.invalid
                        }
                        placeholder="ENTER PATH"
                        onChangeText={updateDerivationPath}
                      />
                    </SSVStack>
                  </Fragment>
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
              disabled={
                (selectedOption === 'address' && (!address || !validAddress)) ||
                (selectedOption === 'descriptor' && (!descriptor && !validDescriptor)) ||
                (selectedOption === 'xpub' &&
                 (!xpub || !validXpub || !validMasterFingerprint || !validDerivationPath)
                )
              }
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
    borderWidth: 1
  },
  valid: {
    //
  }
})
