import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
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
import { type Key } from '@/types/models/Account'

export default function MultiSig() {
  const router = useRouter()
  const [name, setKeyCount, setKeysRequired, setScriptVersion] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.name,
        state.setKeyCount,
        state.setKeysRequired,
        state.setScriptVersion
      ])
    )

  const [localKeyCount, setLocalKeyCount] = useState(DEFAULT_MULTISIG_KEY_COUNT)
  const [localKeysRequired, setLocalKeysRequired] = useState(
    DEFAULT_MULTISIG_KEYS_REQUIRED
  )
  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Key['scriptVersion']>>('P2WPKH')
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  function handleOnPressContinue() {
    setKeyCount(localKeyCount)
    setKeysRequired(localKeysRequired)
    setScriptVersion(localScriptVersion)
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
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.script')} />
              <SSButton
                label={`${t(
                  `script.${localScriptVersion.toLocaleLowerCase()}.name`
                )} (${localScriptVersion})`}
                withSelect
                onPress={() => setScriptVersionModalVisible(true)}
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
      <SSScriptVersionModal
        visible={scriptVersionModalVisible}
        scriptVersion={localScriptVersion}
        onSelect={(scriptVersion) => {
          setLocalScriptVersion(scriptVersion)
          setScriptVersionModalVisible(false)
        }}
        onCancel={() => setScriptVersionModalVisible(false)}
      />
    </SSMainLayout>
  )
}
