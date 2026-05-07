import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput, { type SSTextInputProps } from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'

export default function Add() {
  const router = useRouter()
  const [setAccountName, setAccountPolicyType] = useAccountBuilderStore(
    useShallow((state) => [state.setName, state.setPolicyType])
  )

  const accounts = useAccountsStore((state) => state.accounts)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const currentNetworkAccounts = accounts.filter(
    (account) => account.network === network
  )

  const [localName, setLocalName] = useState('')
  const [localPolicyType, setLocalPolicyType] =
    useState<NonNullable<Account['policyType']>>('singlesig')
  const [isValidName, setIsValidName] = useState<SSTextInputProps['status']>()
  const [isPseudoDuplicatedName, setIsPseudoDuplicatedName] = useState(false) // pseudo-duplicate name = wallet of other network has same name

  function validateName(name: string) {
    if (name === '') {
      setIsValidName(undefined)
      return
    }
    const duplicated = currentNetworkAccounts.some(
      (account) => account.name === name
    )
    setIsValidName(duplicated ? 'invalid' : 'valid')
    const pseudoDuplicated = accounts.some(
      (otherAccount) =>
        otherAccount.network !== network && otherAccount.name === name
    )
    setIsPseudoDuplicatedName(pseudoDuplicated)
  }

  function handleSetName(text: string) {
    setLocalName(text)
    validateName(text)
  }

  function handleOnPressContinue() {
    setAccountName(localName)
    setAccountPolicyType(localPolicyType)

    if (localPolicyType === 'singlesig') {
      router.navigate('/signer/bitcoin/account/add/singleSig')
    } else if (localPolicyType === 'multisig') {
      router.navigate('/signer/bitcoin/account/add/multiSig')
    } else if (localPolicyType === 'watchonly') {
      router.navigate('/signer/bitcoin/account/add/watchOnly')
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('account.add')}</SSText>
        }}
      />
      <SSVStack gap="lg" justifyBetween>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.name')} />
            <SSTextInput
              value={localName}
              status={isValidName}
              onChangeText={handleSetName}
              error={
                isValidName === 'invalid'
                  ? t('account.error.nameDuplicated')
                  : ''
              }
              warning={
                isPseudoDuplicatedName
                  ? t('account.error.namePseudoDuplicated')
                  : ''
              }
            />
          </SSFormLayout.Item>
          <View style={{ marginTop: 24 }}>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={t('account.policy.title')}
                center={false}
              />
              <SSVStack>
                <SSCheckbox
                  label={t('account.policy.singleSignature.title')}
                  description={t('account.policy.singleSignature.description')}
                  selected={localPolicyType === 'singlesig'}
                  onPress={() => setLocalPolicyType('singlesig')}
                />
                <SSCheckbox
                  label={t('account.policy.multiSignature.title')}
                  description={t('account.policy.multiSignature.description')}
                  selected={localPolicyType === 'multisig'}
                  onPress={() => setLocalPolicyType('multisig')}
                />
                <SSCheckbox
                  label={t('account.policy.watchOnly.title')}
                  description={t('account.policy.watchOnly.description')}
                  selected={localPolicyType === 'watchonly'}
                  onPress={() => setLocalPolicyType('watchonly')}
                />
              </SSVStack>
            </SSFormLayout.Item>
          </View>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            variant="secondary"
            label={t('common.continue')}
            disabled={localName === '' || !isValidName}
            onPress={handleOnPressContinue}
          />
          <SSButton
            variant="ghost"
            label={t('common.cancel')}
            onPress={() => router.back()}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
