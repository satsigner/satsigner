import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { type Account } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'

export default function AccountOptions() {
  const router = useRouter()
  const [name, type, setScriptVersion, setSeedWordCount, generateMnemonic] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.name,
        state.type,
        state.setScriptVersion,
        state.setSeedWordCount,
        state.generateMnemonic
      ])
    )

  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Account['scriptVersion']>>('P2WPKH')
  const [localSeedWordCount, setLocalSeedWordCount] =
    useState<NonNullable<Account['seedWordCount']>>(24)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [seedWordCountModalVisible, setSeedWordCountModalVisibile] =
    useState(false)

  const [loading, setLoading] = useState(false)

  function getSeedWordCountButtonLabel() {
    if (localSeedWordCount === 12)
      return `12 ${t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 15)
      return `15 ${t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 18)
      return `18 ${t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 21)
      return `21 ${t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 24)
      return `24 ${t('bitcoin.words').toLowerCase()}`

    return ''
  }

  function getContinueButtonLabel() {
    if (type === 'generate') return t('account.generate.title')
    else if (type === 'import') return t('account.import.title')

    return ''
  }

  async function handleOnPressConfirmAccountOptions() {
    setScriptVersion(localScriptVersion)
    setSeedWordCount(localSeedWordCount)

    if (type === 'generate') {
      setLoading(true)
      await generateMnemonic(localSeedWordCount)
      setLoading(false)
      router.navigate('/addMasterKey/generateSeed')
    } else if (type === 'import') router.navigate('/addMasterKey/importSeed')
  }

  function handleOnSelectSeedWordCount() {
    setLocalSeedWordCount(localSeedWordCount)
    setSeedWordCountModalVisibile(false)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.policy.title')} />
            <SSButton label={t('account.policy.singleSignature')} withSelect />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.script')} />
            <SSButton
              label={`${t(`script.${localScriptVersion.toLocaleLowerCase()}.name`)} (${localScriptVersion})`}
              withSelect
              onPress={() => setScriptVersionModalVisible(true)}
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.mnemonic.title')} />
            <SSButton
              label={getSeedWordCountButtonLabel()}
              withSelect
              onPress={() => setSeedWordCountModalVisibile(true)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            label={getContinueButtonLabel()}
            variant="secondary"
            loading={loading}
            onPress={() => handleOnPressConfirmAccountOptions()}
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
        onCancel={() => setScriptVersionModalVisible(false)}
        onSelect={(scriptVersion) => {
          setLocalScriptVersion(scriptVersion)
          setScriptVersionModalVisible(false)
        }}
      />
      <SSSelectModal
        visible={seedWordCountModalVisible}
        title={t('account.mnemonic.title')}
        selectedText={`${localSeedWordCount} ${t('bitcoin.words')}`}
        selectedDescription={t(`account.mnemonic.${localSeedWordCount}`)}
        onSelect={() => handleOnSelectSeedWordCount()}
        onCancel={() => setSeedWordCountModalVisibile(false)}
      >
        <SSRadioButton
          label={`24 ${t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 24}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 24)}
        />
        <SSRadioButton
          label={`21 ${t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 21}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 21)}
        />
        <SSRadioButton
          label={`18 ${t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 18}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 18)}
        />
        <SSRadioButton
          label={`15 ${t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 15}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 15)}
        />
        <SSRadioButton
          label={`12 ${t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 12}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 12)}
        />
      </SSSelectModal>
    </SSMainLayout>
  )
}
