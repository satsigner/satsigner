import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'

type SignMethod = 'bip137' | 'bip322'

function AddressSignMessage() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const [account, address] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === accountId),
      state.accounts
        .find((account) => account.id === accountId)
        ?.addresses.find((address) => address.address === addr)
    ])
  )

  const [message, setMessage] = useState('')
  const [isSigning, setIsSigning] = useState(false)
  const [signMethod, setSignMethod] = useState<SignMethod | null>(null)
  const [signature, setSignature] = useState('')

  const isTaproot = address?.scriptVersion === 'P2TR'

  async function handleSign(method: SignMethod) {
    if (!message.trim() || isSigning) {
      return
    }

    setSignMethod(method)
    setIsSigning(true)
    setSignature('')

    // TODO: replace with real BIP-137 / BIP-322 signing, using
    // getAddressKeyPair to derive the address key material.
    await new Promise((resolve) => {
      setTimeout(resolve, 1200)
    })
    setSignature(`mock-${method}-signature`)

    setIsSigning(false)
  }

  function handleSignBip137() {
    handleSign('bip137')
  }

  function handleSignBip322() {
    handleSign('bip322')
  }

  if (!account || !address || !addr) {
    return <Redirect href="/" />
  }

  return (
    <SSScrollView keyboardDismissMode="interactive">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('address.signMessage.title')}</SSText>
          )
        }}
      />
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <SSVStack gap="sm">
          <SSText uppercase weight="bold">
            {t('bitcoin.address')}
          </SSText>
          <SSAddressDisplay address={addr} />
        </SSVStack>
        <SSSeparator />
        <SSVStack gap="sm">
          <SSText uppercase weight="bold">
            {t('address.signMessage.message')}
          </SSText>
          <SSTextInput
            align="left"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{ height: 'auto', minHeight: 140, paddingVertical: 10 }}
            placeholder={t('address.signMessage.messagePlaceholder')}
            value={message}
            editable={!isSigning}
            onChangeText={setMessage}
          />
        </SSVStack>
        <SSVStack gap="sm">
          <SSButton
            label={t('address.signMessage.signBip137')}
            variant="outline"
            disabled={isTaproot || !message.trim()}
            loading={isSigning && signMethod === 'bip137'}
            onPress={handleSignBip137}
          />
          {isTaproot && (
            <SSText color="muted" size="xs">
              {t('address.signMessage.bip137UnavailableTaproot')}
            </SSText>
          )}
          <SSButton
            label={t('address.signMessage.signBip322')}
            variant="outline"
            disabled={!message.trim()}
            loading={isSigning && signMethod === 'bip322'}
            onPress={handleSignBip322}
          />
        </SSVStack>
        {isSigning && (
          <SSText center color="muted">
            {t('address.signMessage.signing')}
          </SSText>
        )}
        {!isSigning && signature && (
          <SSVStack gap="sm">
            <SSText uppercase weight="bold">
              {t('address.signMessage.signature')}
            </SSText>
            <SSClipboardCopy text={signature}>
              <SSText type="mono" size="sm">
                {signature}
              </SSText>
            </SSClipboardCopy>
          </SSVStack>
        )}
      </SSVStack>
    </SSScrollView>
  )
}

export default AddressSignMessage
