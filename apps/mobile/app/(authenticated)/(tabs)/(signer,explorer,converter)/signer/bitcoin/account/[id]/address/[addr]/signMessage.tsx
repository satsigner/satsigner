import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Share } from 'react-native'
import { toast } from 'sonner-native'
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
import { type Address } from '@/types/models/Address'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { getAddressDerivationPath } from '@/utils/bitcoin'
import { decryptAccountKeySecret } from '@/utils/decryption'
import { getAddressKeyPair } from '@/utils/key'
import {
  getSupportedSignMethod,
  type MessageSignMethod,
  signAddressMessage
} from '@/utils/message'

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
  const [signMethod, setSignMethod] = useState<MessageSignMethod | null>(null)
  const [signature, setSignature] = useState('')

  const derivationPath =
    account && address ? getAddressDerivationPath(account, address) : ''

  const supportedMethod = getSupportedSignMethod(address?.scriptVersion)

  async function handleSign(method: MessageSignMethod) {
    if (!message.trim() || isSigning) {
      return
    }
    if (!account || !address || !addr) {
      return
    }
    const [key] = account.keys
    if (!key) {
      return
    }

    setSignMethod(method)
    setIsSigning(true)
    setSignature('')

    try {
      const secret = await decryptAccountKeySecret(account.id, key.index)
      const addressWithDerivationPath: Address = { ...address, derivationPath }
      const keyPair = getAddressKeyPair(
        secret,
        addressWithDerivationPath,
        account.network
      )
      if (!keyPair) {
        toast.error(t('address.details.key.unavailable'))
        return
      }
      const privateKey = Buffer.from(keyPair.privateKey, 'hex')
      const result = signAddressMessage(
        privateKey,
        addr,
        message,
        address.scriptVersion,
        account.network
      )
      privateKey.fill(0)
      setSignature(result)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason'
      toast.error(`${t('address.details.key.unableToDecrypt')}: ${reason}`)
    } finally {
      setIsSigning(false)
    }
  }

  function handleSignBip137() {
    handleSign('bip137')
  }

  function handleSignBip322() {
    handleSign('bip322')
  }

  async function handleShareSignature() {
    if (!signature) {
      return
    }
    try {
      await Share.share({ message: signature })
    } catch {
      toast.error(t('address.signMessage.shareError'))
    }
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
            disabled={supportedMethod !== 'bip137' || !message.trim()}
            loading={isSigning && signMethod === 'bip137'}
            onPress={handleSignBip137}
          />
          {supportedMethod !== 'bip137' && (
            <SSText color="muted" size="xs">
              {t('address.signMessage.bip137Unavailable')}
            </SSText>
          )}
          <SSButton
            label={t('address.signMessage.signBip322')}
            variant="outline"
            disabled={supportedMethod !== 'bip322' || !message.trim()}
            loading={isSigning && signMethod === 'bip322'}
            onPress={handleSignBip322}
          />
          {supportedMethod !== 'bip322' && (
            <SSText color="muted" size="xs">
              {t('address.signMessage.bip322Unavailable')}
            </SSText>
          )}
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
            <SSClipboardCopy text={signature}>
              <SSButton
                label={t('common.copyToClipboard')}
                variant="outline"
                onPress={() => true}
              />
            </SSClipboardCopy>
            <SSButton
              label={t('common.share')}
              variant="outline"
              onPress={handleShareSignature}
            />
          </SSVStack>
        )}
      </SSVStack>
    </SSScrollView>
  )
}

export default AddressSignMessage
