import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSText from '@/components/SSText'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

export default function SingleSig() {
  const router = useRouter()
  const [name, setKeyCount, setKeysRequired] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.setKeyCount,
      state.setKeysRequired
    ])
  )

  const [localKeysCount, setLocalKeysCount] = useState(3)
  const [localKeysRequired, setLocalKeysRequired] = useState(2)

  function handleOnPressContinue() {
    setKeyCount(localKeysCount)
    setKeysRequired(localKeysRequired)
    router.navigate('/') // TODO: change
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
                maxCount={12}
                requiredNumber={localKeysRequired}
                totalNumber={localKeysCount}
                onChangeRequiredNumber={setLocalKeysRequired}
                onChangeTotalNumber={setLocalKeysCount}
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
