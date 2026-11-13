import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMnemonicWordCountSelectModal from '@/components/SSMnemonicWordCountSelectModal'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import { ENTROPY_TYPES } from '@/config/entropy'
import { useSelectModalDraft } from '@/hooks/useSelectModalDraft'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { useSettingsStore } from '@/store/settings'
import { WORDLIST_LIST } from '@/types/bips/39'
import { type EntropyType } from '@/types/logic/entropy'
import { type Key } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import { generateMnemonic, getFingerprintFromMnemonic } from '@/utils/bip39'

export default function SingleSig() {
  const router = useRouter()
  const [
    name,
    setScriptVersion,
    setEntropy,
    setMnemonicWordCount,
    setMnemonicWordList,
    setGeneratedMnemonic,
    setKeyCount,
    setKeysRequired,
    setCreationType,
    setNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.setScriptVersion,
      state.setEntropy,
      state.setMnemonicWordCount,
      state.setMnemonicWordList,
      state.setGeneratedMnemonic,
      state.setKeyCount,
      state.setKeysRequired,
      state.setCreationType,
      state.setNetwork
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const wordList = useSettingsStore((state) => state.mnemonicWordList)

  const entropyPicker = useSelectModalDraft<EntropyType>('none')
  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Key['scriptVersion']>>('P2WPKH')
  const wordCountPicker =
    useSelectModalDraft<NonNullable<Key['mnemonicWordCount']>>(24)
  const wordListPicker = useSelectModalDraft(wordList)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  const [loading, setLoading] = useState(false)

  function handleOnPress(type: NonNullable<Key['creationType']>) {
    useAccountBuilderStore.getState().clearKeyState()
    setCreationType(type)
    setScriptVersion(localScriptVersion)
    setEntropy(entropyPicker.value)
    setMnemonicWordCount(wordCountPicker.value)
    setMnemonicWordList(wordListPicker.value)
    setKeyCount(1)
    setKeysRequired(1)
    setNetwork(network)

    if (type === 'generateMnemonic') {
      switch (entropyPicker.value) {
        case 'none': {
          setLoading(true)
          const mnemonic = generateMnemonic(
            wordCountPicker.value,
            wordListPicker.value
          )
          setGeneratedMnemonic(mnemonic, getFingerprintFromMnemonic(mnemonic))

          setLoading(false)
          router.navigate('/signer/bitcoin/account/add/generate/mnemonic/0')
          break
        }
        case 'drawing': {
          router.navigate({
            params: { index: 0 },
            pathname: '/signer/bitcoin/account/add/entropy/drawing'
          })
          break
        }
        case 'coin': {
          router.navigate({
            params: { index: 0 },
            pathname: '/signer/bitcoin/account/add/entropy/coin'
          })
          break
        }
        case 'dice': {
          router.navigate({
            params: { index: 0 },
            pathname: '/signer/bitcoin/account/add/entropy/dice'
          })
          break
        }
        default: {
          break
        }
      }
    } else if (type === 'importMnemonic') {
      router.navigate('/signer/bitcoin/account/add/import/mnemonic/0')
    } else if (type === 'importWif') {
      router.navigate('/signer/bitcoin/account/add/import/wif/0')
    }
  }

  if (!name) {
    return <Redirect href="/" />
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSVStack>
            <SSFormLayout>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.policy.title')} />
                <SSText center weight="bold">
                  {t('account.policy.singleSignature.title').toUpperCase()}
                </SSText>
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
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.mnemonic.title')} />
                <SSButton
                  label={`${wordCountPicker.value} ${t(
                    'bitcoin.words'
                  ).toLowerCase()}`}
                  withSelect
                  onPress={wordCountPicker.open}
                />
              </SSFormLayout.Item>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.mnemonic.wordList')} />
                <SSButton
                  label={wordListPicker.value}
                  withSelect
                  onPress={wordListPicker.open}
                />
              </SSFormLayout.Item>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.entropy.title')} />
                <SSButton
                  label={t(`account.entropy.${entropyPicker.value}.label`)}
                  withSelect
                  onPress={entropyPicker.open}
                />
              </SSFormLayout.Item>
            </SSFormLayout>
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label={t('account.import.title2')}
              onPress={() => handleOnPress('importMnemonic')}
            />
            <SSButton
              label={t('account.import.wif.title')}
              onPress={() => handleOnPress('importWif')}
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
      </ScrollView>
      <SSScriptVersionModal
        visible={scriptVersionModalVisible}
        scriptVersion={localScriptVersion}
        onSelect={(scriptVersion) => {
          setLocalScriptVersion(scriptVersion)
          setScriptVersionModalVisible(false)
        }}
        onCancel={() => setScriptVersionModalVisible(false)}
      />
      <SSMnemonicWordCountSelectModal
        visible={wordCountPicker.visible}
        selectedWordCount={wordCountPicker.draft}
        onChange={wordCountPicker.setDraft}
        onSelect={wordCountPicker.select}
        onCancel={wordCountPicker.cancel}
      />
      <SSSelectModal
        visible={wordListPicker.visible}
        title={t('account.mnemonic.wordList')}
        selectedText={t('account.mnemonic.wordListText', {
          wordList: wordListPicker.draft.replaceAll('_', ' ')
        })}
        selectedDescription={t('account.mnemonic.wordListDescription', {
          wordList: wordListPicker.draft.replaceAll('_', ' ')
        })}
        onSelect={wordListPicker.select}
        onCancel={wordListPicker.cancel}
      >
        {WORDLIST_LIST.map((wordList) => (
          <SSRadioButton
            key={wordList}
            label={wordList.replaceAll('_', ' ')}
            selected={wordListPicker.draft === wordList}
            onPress={() =>
              setStateWithLayoutAnimation(wordListPicker.setDraft, wordList)
            }
          />
        ))}
      </SSSelectModal>
      <SSSelectModal
        visible={entropyPicker.visible}
        title={t('account.entropy.title')}
        selectedText={t(`account.entropy.${entropyPicker.draft}.label`)}
        onSelect={entropyPicker.select}
        onCancel={entropyPicker.cancel}
      >
        {ENTROPY_TYPES.map((entropy) => (
          <SSRadioButton
            key={entropy}
            label={t(`account.entropy.${entropy}.label`)}
            selected={entropyPicker.draft === entropy}
            onPress={() =>
              setStateWithLayoutAnimation(entropyPicker.setDraft, entropy)
            }
          />
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
