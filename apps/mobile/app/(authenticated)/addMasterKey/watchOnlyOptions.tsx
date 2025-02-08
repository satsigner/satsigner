import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as Clipboard from 'expo-clipboard'

import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import SSButton from '@/components/SSButton'
import { ScrollView } from 'react-native'

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

export default function AccountOptions() {
  const name = useAccountBuilderStore(useShallow((state) => state.name))
  const [selectedOption, setSelectedOption] = useState<WatchOnlyOption>('xpub')
  const [modalOptionsVisible, setModalOptionsVisible] = useState(true)
  const [input, setInput] = useState('')

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (text) setInput(text)
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
                <SSTextInput
                  value={input}
                  placeholder={`ENTER ${selectedOption.toUpperCase()}`}
                  onChangeText={(text) => setInput(text)}
                />
              </SSVStack>
              {selectedOption === 'xpub' && (
                <SSVStack gap="xs">
                  <SSText center>MASTER FINGERPRINT (optional)</SSText>
                  <SSTextInput />
                  <SSText center>DERIVATION PATH (optional)</SSText>
                  <SSTextInput />
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
