import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import { KeychainKind } from 'react-native-bdk-sdk'
import { useShallow } from 'zustand/react/shallow'

import { getDescriptorString } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, getKeySecret } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account, type Secret } from '@/types/models/Account'
import { type ImportDescriptorSearchParams } from '@/types/navigation/searchParams'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { aesDecrypt } from '@/utils/crypto'

function ImportDescriptorFromAccount() {
  const router = useRouter()
  const { keyIndex } = useLocalSearchParams<ImportDescriptorSearchParams>()
  const accounts = useAccountsStore((state) => state.accounts)
  const [
    setKey,
    setExternalDescriptor,
    updateKeyFingerprint,
    setKeyDerivationPath,
    setExtendedPublicKey,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setKey,
      state.setExternalDescriptor,
      state.updateKeyFingerprint,
      state.setKeyDerivationPath,
      state.setExtendedPublicKey,
      state.clearKeyState
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const singleSignatureAccounts = useMemo(
    () => accounts.filter((account) => account.policyType === 'singlesig'),
    [accounts]
  )

  const [selectedAccountId, setSelectedAccountId] = useState<Account['id']>()
  const [loading, setLoading] = useState(false)

  async function handlePressCreate() {
    setLoading(true)
    const pin = await getItem(PIN_KEY)
    if (!pin) {
      return
    }
    const chosenAccount = accounts.find(
      (account) => account.id === selectedAccountId
    )
    if (!chosenAccount) {
      return
    }

    const [firstKey] = chosenAccount.keys
    const stored = await getKeySecret(chosenAccount.id, 0)
    if (!stored) {
      return
    }

    const accountSecretString = await aesDecrypt(stored.secret, pin, stored.iv)
    const accountSecret = JSON.parse(accountSecretString) as Secret

    const { creationType } = firstKey
    let externalDescriptorString: Secret['externalDescriptor']

    if (creationType !== 'importDescriptor') {
      const { mnemonic } = accountSecret
      const { scriptVersion } = firstKey
      const { passphrase } = accountSecret
      if (!mnemonic || !scriptVersion) {
        return
      }

      externalDescriptorString = await getDescriptorString(
        mnemonic,
        scriptVersion,
        KeychainKind.External,
        passphrase,
        appNetworkToBdkNetwork(network)
      )
    } else {
      if (!accountSecret.externalDescriptor) {
        return
      }
      externalDescriptorString = accountSecret.externalDescriptor
    }

    if (!externalDescriptorString) {
      return
    }

    setExternalDescriptor(externalDescriptorString)
    const extendedPublicKey = getExtendedKeyFromDescriptor(
      externalDescriptorString
    )
    setExtendedPublicKey(extendedPublicKey)
    setKey(Number(keyIndex))
    updateKeyFingerprint(
      Number(keyIndex),
      chosenAccount.keys[0].fingerprint as string
    )
    setKeyDerivationPath(
      Number(keyIndex),
      chosenAccount.keys[0].derivationPath as string
    )
    setKey(Number(keyIndex))
    clearKeyState()

    setLoading(false)
    router.dismiss(3)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.fromOtherWallet')}</SSText>
          )
        }}
      />
      <SSVStack justifyBetween>
        <ScrollView>
          <SSVStack gap="lg">
            <SSText center>{t('account.import.existingSingleWallet')}</SSText>
            {singleSignatureAccounts.map((account) => (
              <SSHStack key={account.name}>
                <SSCheckbox
                  selected={selectedAccountId === account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                />
                <TouchableOpacity
                  onPress={() => setSelectedAccountId(account.id)}
                >
                  <SSVStack gap="none">
                    <SSText size="xxs">{account.keys[0].fingerprint}</SSText>
                    <SSText style={{ lineHeight: 19 }} size="2xl">
                      {account.name}
                    </SSText>
                  </SSVStack>
                </TouchableOpacity>
              </SSHStack>
            ))}
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            variant="secondary"
            uppercase
            label={t('common.create')}
            disabled={!selectedAccountId}
            loading={loading}
            onPress={handlePressCreate}
          />
          <SSButton
            variant="ghost"
            uppercase
            label={t('common.cancel')}
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

export default ImportDescriptorFromAccount
