import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { type Account, type MultisigParticipant } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'

export default function ParticipantOptions() {
  const router = useRouter()
  const [
    name,
    participantCreationType,
    setScriptVersion,
    setSeedWordCount,
    generateMnemonic,
    setParticipantName
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.participantCreationType,
      state.setScriptVersion,
      state.setSeedWordCount,
      state.generateMnemonic,
      state.setParticipantName
    ])
  )

  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Account['scriptVersion']>>('P2WPKH')
  const [localSeedWordCount, setLocalSeedWordCount] =
    useState<NonNullable<Account['seedWordCount']>>(24)
  const [localKeyName, setLocalKeyName] =
    useState<NonNullable<MultisigParticipant['keyName']>>('')

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
    if (participantCreationType === 'generate')
      return t('account.generate.title')
    else if (participantCreationType === 'importseed')
      return t('account.import.title').replace(' ', '')
    return ''
  }

  async function handleOnPressConfirmAccountOptions() {
    setScriptVersion(localScriptVersion)
    setSeedWordCount(localSeedWordCount)
    setParticipantName(localKeyName)
    if (participantCreationType === 'generate') {
      setLoading(true)
      await generateMnemonic(localSeedWordCount)
      setLoading(false)
      router.replace('/addMasterKey/generateSeed')
    } else if (participantCreationType === 'importseed')
      router.replace('/addMasterKey/importSeed')
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
        <SSVStack>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.participant.keyName')} />
              <SSTextInput
                value={localKeyName}
                onChangeText={setLocalKeyName}
              />
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
        </SSVStack>
        <SSVStack>
          <SSButton
            label={getContinueButtonLabel()}
            variant="secondary"
            loading={loading}
            disabled={!localKeyName.length}
            onPress={() => handleOnPressConfirmAccountOptions()}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            disabled={!localKeyName.length}
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
