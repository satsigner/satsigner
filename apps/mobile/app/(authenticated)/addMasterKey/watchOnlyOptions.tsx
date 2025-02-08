import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSCollapsible from '@/components/SSCollapsible'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import { useAccountBuilderStore } from '@/store/accountBuilder'

const watchOnlyTypes = ['xpub', 'descriptor', 'address']

type WatchOnlyType = (typeof watchOnlyTypes)[number]

export default function AccountOptions() {
  const name = useAccountBuilderStore(useShallow((state) => state.name))
  const [selectedType, setSelectedType] = useState<WatchOnlyType>('xpub')

  const labels: Record<WatchOnlyType, string> = {
    xpub: 'XPUB / YPUB / ZPUB',
    descriptor: 'DESCRIPTOR',
    address: 'Address'
  }

  const title: Record<WatchOnlyType, string> = {
    xpub: 'Extended Public Key',
    descriptor: 'Descriptor',
    address: 'Address'
  }

  const text: Record<WatchOnlyType, string> = {
    xpub: 'An extended public key is a type of key used in Bitcoin that allows for the generation of multiple public addresses from a single key. It is part of the hierarchical deterministic (HD) wallet structure defined by BIP32. An xpub can generate child public keys, which can be used to receive funds without exposing the corresponding private keys. This feature is useful for managing multiple addresses while maintaining privacy and security, as users can receive payments at different addresses without needing to create new wallets or expose sensitive information.',
    descriptor:
      'A Bitcoin descriptor is a flexible and expressive way to describe how Bitcoin addresses and keys are derived and used within a wallet. Introduced in BIP 174, descriptors allow users to specify the structure of their wallets in a more human-readable format. They can represent various types of addresses, including standard pay-to-public-key-hash (P2PKH), pay-to-script-hash (P2SH), and more complex constructions such as multisig. Descriptors improve wallet interoperability and make it easier for software to understand how to derive keys and addresses based on user-defined rules.',
    address: 'A single bitcoin address'
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSSelectModal
        visible
        title="WATCH-ONLY WALLET"
        selectedText={title[selectedType]}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {text[selectedType]}
            </SSText>
          </SSCollapsible>
        }
        onSelect={() => null}
        onCancel={() => router.back()}
      >
        {watchOnlyTypes.map((type) => (
          <SSRadioButton
            key={type}
            label={labels[type]}
            selected={selectedType === type}
            onPress={() => setSelectedType(type)}
          />
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
