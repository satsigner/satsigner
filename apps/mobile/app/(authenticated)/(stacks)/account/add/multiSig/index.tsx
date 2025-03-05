import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSText from '@/components/SSText'
import {
  DEFAULT_MULTISIG_KEY_COUNT,
  DEFAULT_MULTISIG_KEYS_REQUIRED,
  MAX_MULTISIG_KEYS
} from '@/config/keys'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

export default function MultiSig() {
  const router = useRouter()
  const [name, setKeyCount, setKeysRequired] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.setKeyCount,
      state.setKeysRequired
    ])
  )

  const [localKeyCount, setLocalKeyCount] = useState(DEFAULT_MULTISIG_KEY_COUNT)
  const [localKeysRequired, setLocalKeysRequired] = useState(
    DEFAULT_MULTISIG_KEYS_REQUIRED
  )

  function handleOnPressContinue() {
    setKeyCount(localKeyCount)
    setKeysRequired(localKeysRequired)
    router.navigate('/account/add/multiSig/manager')
  }

  if (!name) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.policy.title')} />
              <SSText center weight="bold">
                {t('account.policy.multiSignature.title').toUpperCase()}
              </SSText>
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSMultisigCountSelector
                maxCount={MAX_MULTISIG_KEYS}
                requiredNumber={localKeysRequired}
                totalNumber={localKeyCount}
                onChangeRequiredNumber={setLocalKeysRequired}
                onChangeTotalNumber={setLocalKeyCount}
                viewOnly={false}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={t('common.continue')}
            variant="secondary"
            onPress={handleOnPressContinue}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.navigate('/')}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
