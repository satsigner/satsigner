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
import {
  type Account,
  type MultisigParticipant,
  type SeedWordCountType
} from '@/types/models/Account'
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
    return `${localSeedWordCount} ${t('bitcoin.words').toLowerCase()}`
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
        {[24, 21, 18, 15, 12].map((count) => (
          <SSRadioButton
            key={count}
            label={`${count} ${t('bitcoin.words').toLowerCase()}`}
            selected={localSeedWordCount === count}
            onPress={() =>
              setStateWithLayoutAnimation(
                setLocalSeedWordCount,
                count as SeedWordCountType
              )
            }
          />
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
