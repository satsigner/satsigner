import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'

function SelectFromOtherWallet() {
  const [accounts] = useAccountsStore(useShallow((state) => [state.accounts]))
  const [setParticipantWithDescriptor] = useAccountBuilderStore(
    useShallow((state) => [state.setParticipantWithDescriptor])
  )
  const router = useRouter()

  const singleAccount = useMemo(() => {
    return accounts.filter((account) => account.policyType === 'single')
  }, [accounts])

  const [selectedAccountName, setSelectedAccountName] = useState<string>('')

  function handlePressCancel() {
    router.back()
  }

  function handlePressCreate() {
    const selectedAccount = singleAccount.find(
      (account) => account.name === selectedAccountName
    )
    setParticipantWithDescriptor(selectedAccount?.externalDescriptor ?? '')
    router.dismiss(2)
  }

  function handleClickCheckBox(accountName: string) {
    if (accountName !== selectedAccountName) {
      setSelectedAccountName(accountName)
    } else {
      setSelectedAccountName('')
    }
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
            {singleAccount.map((account) => (
              <SSHStack key={account.name}>
                <SSCheckbox
                  label=""
                  selected={selectedAccountName === account.name}
                  onPress={() => handleClickCheckBox(account.name)}
                />
                <SSVStack gap="none">
                  <SSText size="xxs">{account.fingerprint}</SSText>
                  <SSText style={{ lineHeight: 19 }} size="2xl">
                    {account.name}
                  </SSText>
                </SSVStack>
              </SSHStack>
            ))}
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            variant="secondary"
            uppercase
            label={t('common.create')}
            disabled={!selectedAccountName}
            onPress={handlePressCreate}
          />
          <SSButton
            variant="ghost"
            uppercase
            label={t('common.cancel')}
            onPress={handlePressCancel}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

export default SelectFromOtherWallet
