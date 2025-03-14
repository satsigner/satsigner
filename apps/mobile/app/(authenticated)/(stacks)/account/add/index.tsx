import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { type Account } from '@/types/models/Account'

export default function Add() {
  const router = useRouter()
  const [setAccountName, setAccountPolicyType] = useAccountBuilderStore(
    useShallow((state) => [state.setName, state.setPolicyType])
  )

  const [localName, setLocalName] = useState('')
  const [localPolicyType, setLocalPolicyType] =
    useState<NonNullable<Account['policyType']>>('singlesig')

  function handleOnPressContinue() {
    setAccountName(localName)
    setAccountPolicyType(localPolicyType)

    if (localPolicyType === 'singlesig')
      router.navigate('/account/add/singleSig')
    else if (localPolicyType === 'multisig')
      router.navigate('/account/add/multiSig')
    else if (localPolicyType === 'watchonly')
      router.navigate('/account/add/watchOnly')
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
              onChangeText={(text) => setLocalName(text)}
            />
          </SSFormLayout.Item>
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
        </SSFormLayout>
        <SSVStack>
          <SSButton
            variant="secondary"
            label={t('common.continue')}
            disabled={localName === ''}
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
