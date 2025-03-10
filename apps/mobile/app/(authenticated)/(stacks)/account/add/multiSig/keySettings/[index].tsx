import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { generateMnemonic, getFingerprint } from '@/api/bdk'
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
import { useBlockchainStore } from '@/store/blockchain'
import { type Key } from '@/types/models/Account'
import { type MultiSigKeySettingsSearchParams } from '@/types/navigation/searchParams'
import { setStateWithLayoutAnimation } from '@/utils/animation'

export default function MultiSigKeySettings() {
  const { index } = useLocalSearchParams<MultiSigKeySettingsSearchParams>()
  const router = useRouter()
  const [
    name,
    setKeyName,
    keyCount,
    setScriptVersion,
    setMnemonicWordCount,
    setMnemonic,
    setFingerprint,
    setCreationType
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.setKeyName,
      state.keyCount,
      state.setScriptVersion,
      state.setMnemonicWordCount,
      state.setMnemonic,
      state.setFingerprint,
      state.setCreationType
    ])
  )
  const network = useBlockchainStore((state) => state.network)

  const [localKeyName, setLocalKeyName] = useState('')
  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Key['scriptVersion']>>('P2WPKH')
  const [localMnemonicWordCount, setLocalMnemonicWordCount] =
    useState<NonNullable<Key['mnemonicWordCount']>>(24)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [mnemonicWordCountModalVisible, setMnemonicWordCountModalVisibile] =
    useState(false)

  const [loading, setLoading] = useState(false)

  async function handleOnPress(type: NonNullable<Key['creationType']>) {
    setCreationType(type)
    setKeyName(localKeyName)
    setScriptVersion(localScriptVersion)
    setMnemonicWordCount(localMnemonicWordCount)

    if (type === 'generateMnemonic') {
      setLoading(true)

      const mnemonic = await generateMnemonic(localMnemonicWordCount)
      setMnemonic(mnemonic)

      const fingerprint = await getFingerprint(
        mnemonic,
        undefined,
        network as Network
      )
      setFingerprint(fingerprint)

      setLoading(false)
      router.navigate(`/account/add/generate/mnemonic/${index}`)
    } else if (type === 'importMnemonic')
      router.navigate(`/account/add/import/mnemonic/${index}`)
    else if (type === 'importDescriptor') router.navigate('') // TODO
  }

  function handleOnSelectMnemonicWordCount() {
    setLocalMnemonicWordCount(localMnemonicWordCount)
    setMnemonicWordCountModalVisibile(false)
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
              <SSFormLayout.Label label={t('account.key.number')} />
              <SSText center weight="bold">
                {Number(index) + 1} {t('common.of').toLowerCase()} {keyCount}
              </SSText>
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.name')} />
              <SSTextInput
                value={localKeyName}
                onChangeText={(text) => setLocalKeyName(text)}
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
                label={`${localMnemonicWordCount} ${t('bitcoin.words').toLowerCase()}`}
                withSelect
                onPress={() => setMnemonicWordCountModalVisibile(true)}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={t('account.import.descriptor')}
            onPress={() => handleOnPress('importDescriptor')}
          />
          <SSButton
            label={t('account.import.title2')}
            onPress={() => handleOnPress('importMnemonic')}
          />
          <SSButton
            label={t('account.generate.title')}
            variant="secondary"
            loading={loading}
            onPress={() => handleOnPress('generateMnemonic')}
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
      <SSSelectModal
        visible={mnemonicWordCountModalVisible}
        title={t('account.mnemonic.title')}
        selectedText={`${localMnemonicWordCount} ${t('bitcoin.words')}`}
        selectedDescription={t(`account.mnemonic.${localMnemonicWordCount}`)}
        onSelect={handleOnSelectMnemonicWordCount}
        onCancel={() => setMnemonicWordCountModalVisibile(false)}
      >
        {([24, 21, 18, 15, 12] as const).map((count) => (
          <SSRadioButton
            key={count}
            label={`${count} ${t('bitcoin.words').toLowerCase()}`}
            selected={localMnemonicWordCount === count}
            onPress={() =>
              setStateWithLayoutAnimation(setLocalMnemonicWordCount, count)
            }
          />
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
