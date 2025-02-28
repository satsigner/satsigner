import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

export default function AddMasterKey() {
  const router = useRouter()
  const hasAccountWithName = useAccountsStore(
    (state) => state.hasAccountWithName
  )
  const [setName, setType] = useAccountBuilderStore(
    useShallow((state) => [state.setName, state.setType])
  )

  const [accountName, setAccountName] = useState('')
  const actionsDisabled = accountName.length < 1

  function handleOnPressAddMasterKey(
    creationType: Account['accountCreationType'],
    watchOnly = false
  ) {
    if (hasAccountWithName(accountName)) {
      Alert.alert(t('account.hasAccountWithName'))
      setAccountName('')
      return
    }

    setName(accountName)
    setType(creationType)
    if (watchOnly) router.navigate('/addMasterKey/watchOnlyOptions')
    else router.navigate('/addMasterKey/accountOptions')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('account.add')}</SSText>
        }}
      />
      <SSVStack gap="lg">
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.name')} />
            <SSTextInput
              value={accountName}
              onChangeText={(accountName) => setAccountName(accountName)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            label={t('account.generate.title')}
            disabled={actionsDisabled}
            onPress={() => handleOnPressAddMasterKey('generate')}
          />
          <SSButton
            label={t('account.import.title')}
            disabled={actionsDisabled}
            onPress={() => handleOnPressAddMasterKey('import')}
          />
          <SSButton
            label={t('account.import.watchOnly.title')}
            disabled={actionsDisabled}
            onPress={() => handleOnPressAddMasterKey('import', true)}
          />
          <SSButton
            label={t('account.import.wif.title')}
            disabled={actionsDisabled}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
