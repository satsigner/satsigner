import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import { ENTROPY_TYPES } from '@/config/entropy'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { useSettingsStore } from '@/store/settings'
import { type EntropyType } from '@/types/logic/entropy'
import { type Key } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import {
  generateMnemonic,
  getFingerprintFromMnemonic,
  WORDLIST_LIST
} from '@/utils/bip39'

export default function SingleSig() {
  const router = useRouter()
  const [
    name,
    setScriptVersion,
    setEntropy,
    setMnemonicWordCount,
    setMnemonicWordList,
    setMnemonic,
    setFingerprint,
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
      state.setMnemonic,
      state.setFingerprint,
      state.setKeyCount,
      state.setKeysRequired,
      state.setCreationType,
      state.setNetwork
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const wordList = useSettingsStore((state) => state.mnemonicWordList)

  const [localEntropyType, setLocalEntropyType] = useState<EntropyType>('none')
  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Key['scriptVersion']>>('P2WPKH')
  const [localMnemonicWordCount, setLocalMnemonicWordCount] =
    useState<NonNullable<Key['mnemonicWordCount']>>(24)
  const [localMnemonicWordList, setLocalMnemonicWordList] = useState(wordList)

  const [entropyModalVisible, setEntropyModalVisible] = useState(false)
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [mnemonicWordCountModalVisible, setMnemonicWordCountModalVisible] =
    useState(false)
  const [mnemonicWordListModalVisible, setMnemonicWordListModalVisible] =
    useState(false)

  const [loading, setLoading] = useState(false)

  async function handleOnPress(type: NonNullable<Key['creationType']>) {
    setCreationType(type)
    setScriptVersion(localScriptVersion)
    setEntropy(localEntropyType)
    setMnemonicWordCount(localMnemonicWordCount)
    setMnemonicWordList(localMnemonicWordList)
    setKeyCount(1)
    setKeysRequired(1)
    setNetwork(network)

    if (type === 'generateMnemonic') {
      switch (localEntropyType) {
        case 'none': {
          setLoading(true)
          const mnemonic = generateMnemonic(
            localMnemonicWordCount,
            localMnemonicWordList
          )
          setMnemonic(mnemonic)

          const fingerprint = getFingerprintFromMnemonic(mnemonic)
          setFingerprint(fingerprint)

          setLoading(false)
          router.navigate('/account/add/generate/mnemonic/0')
          break
        }
        case 'drawing': {
          break
        }
        case 'coin': {
          router.navigate({
            pathname: '/account/add/entropy/coin',
            params: { index: 0 }
          })
          break
        }
        case 'dice': {
          router.navigate({
            pathname: '/account/add/entropy/dice',
            params: { index: 0 }
          })
          break
        }
      }
    } else if (type === 'importMnemonic') {
      // For import, navigate to mnemonic input
      router.navigate('/account/add/import/mnemonic/0')
    }
  }

  function handleOnSelectMnemonicWordCount() {
    setMnemonicWordCount(localMnemonicWordCount)
    setMnemonicWordCountModalVisible(false)
  }

  function handleOnSelectMnemonicWordList() {
    setMnemonicWordList(localMnemonicWordList)
    setMnemonicWordListModalVisible(false)
  }

  function handleOnSelectEntropy() {
    setLocalEntropyType(localEntropyType)
    setEntropyModalVisible(false)
  }

  if (!name) return <Redirect href="/" />

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
                  label={`${localMnemonicWordCount} ${t(
                    'bitcoin.words'
                  ).toLowerCase()}`}
                  withSelect
                  onPress={() => setMnemonicWordCountModalVisible(true)}
                />
              </SSFormLayout.Item>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.mnemonic.wordList')} />
                <SSButton
                  label={localMnemonicWordList}
                  withSelect
                  onPress={() => setMnemonicWordListModalVisible(true)}
                />
              </SSFormLayout.Item>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.entropy.title')} />
                <SSButton
                  label={t(`account.entropy.${localEntropyType}.label`)}
                  withSelect
                  onPress={() => setEntropyModalVisible(true)}
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
      <SSSelectModal
        visible={mnemonicWordCountModalVisible}
        title={t('account.mnemonic.title')}
        selectedText={`${localMnemonicWordCount} ${t('bitcoin.words')}`}
        selectedDescription={t(`account.mnemonic.${localMnemonicWordCount}`)}
        onSelect={handleOnSelectMnemonicWordCount}
        onCancel={() => setMnemonicWordCountModalVisible(false)}
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
      <SSSelectModal
        visible={mnemonicWordListModalVisible}
        title={t('account.mnemonic.wordList')}
        selectedText={t('account.mnemonic.wordListText', {
          wordList: localMnemonicWordList.replaceAll('_', ' ')
        })}
        selectedDescription={t('account.mnemonic.wordListDescription', {
          wordList: localMnemonicWordList.replaceAll('_', ' ')
        })}
        onSelect={handleOnSelectMnemonicWordList}
        onCancel={() => setMnemonicWordListModalVisible(false)}
      >
        {WORDLIST_LIST.map((wordList) => (
          <SSRadioButton
            key={wordList}
            label={wordList.replaceAll('_', ' ')}
            selected={localMnemonicWordList === wordList}
            onPress={() =>
              setStateWithLayoutAnimation(setLocalMnemonicWordList, wordList)
            }
          />
        ))}
      </SSSelectModal>
      <SSSelectModal
        visible={entropyModalVisible}
        title={t('account.entropy.title')}
        selectedText={t(`account.entropy.${localEntropyType}.label`)}
        onSelect={handleOnSelectEntropy}
        onCancel={() => setEntropyModalVisible(false)}
      >
        {ENTROPY_TYPES.map((entropy) => (
          <SSRadioButton
            key={entropy}
            label={t(`account.entropy.${entropy}.label`)}
            selected={localEntropyType === entropy}
            onPress={() =>
              setStateWithLayoutAnimation(setLocalEntropyType, entropy)
            }
          />
        ))}
      </SSSelectModal>
    </SSMainLayout>
  )
}
