import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSMnemonicWordCountSelectModal from '@/components/SSMnemonicWordCountSelectModal'
import SSRadioButton from '@/components/SSRadioButton'
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
import { type EntropyType } from '@/types/logic/entropy'
import { type Key } from '@/types/models/Account'
import { type MultiSigKeySettingsSearchParams } from '@/types/navigation/searchParams'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import { generateMnemonic, getFingerprintFromMnemonic } from '@/utils/bip39'

export default function MultiSigKeySettings() {
  const { index } = useLocalSearchParams<MultiSigKeySettingsSearchParams>()
  const router = useRouter()
  const [
    name,
    keyCount,
    setEntropy,
    setMnemonicWordCount,
    setMnemonicWordList,
    setGeneratedMnemonic,
    setCreationType,
    setNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keyCount,
      state.setEntropy,
      state.setMnemonicWordCount,
      state.setMnemonicWordList,
      state.setGeneratedMnemonic,
      state.setCreationType,
      state.setNetwork
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const entropyPicker = useSelectModalDraft<EntropyType>('none')
  const wordCountPicker =
    useSelectModalDraft<NonNullable<Key['mnemonicWordCount']>>(24)
  // TODO: add support for multi-lang word list

  const [loading, setLoading] = useState(false)

  function handleOnPress(type: NonNullable<Key['creationType']>) {
    setCreationType(type)
    setEntropy(entropyPicker.value)
    setMnemonicWordCount(wordCountPicker.value)
    setMnemonicWordList('english')
    setNetwork(network)

    if (type === 'generateMnemonic') {
      switch (entropyPicker.value) {
        case 'none': {
          setLoading(true)

          // Multisig generate currently always uses the English wordlist.
          const mnemonic = generateMnemonic(wordCountPicker.value, 'english')
          setGeneratedMnemonic(mnemonic, getFingerprintFromMnemonic(mnemonic))

          setLoading(false)
          router.navigate(
            `/signer/bitcoin/account/add/generate/mnemonic/${index}`
          )
          break
        }
        case 'drawing': {
          router.navigate({
            params: { index },
            pathname: '/signer/bitcoin/account/add/entropy/drawing'
          })
          break
        }
        case 'coin': {
          router.navigate({
            params: { index },
            pathname: '/signer/bitcoin/account/add/entropy/coin'
          })
          break
        }
        case 'dice': {
          router.navigate({
            params: { index },
            pathname: '/signer/bitcoin/account/add/entropy/dice'
          })
          break
        }
        default: {
          break
        }
      }
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
              <SSFormLayout.Label label={t('account.entropy.title')} />
              <SSButton
                label={t(`account.entropy.${entropyPicker.value}.label`)}
                withSelect
                onPress={entropyPicker.open}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
        </SSVStack>
        <SSVStack>
          <SSButton
            label={t('account.generate.title')}
            variant="secondary"
            loading={loading}
            onPress={() => handleOnPress('generateMnemonic')}
          />
          <SSButton
            label={t('common.cancel')}
            variant="ghost"
            onPress={() => router.dismiss(1)}
          />
        </SSVStack>
      </SSVStack>
      <SSMnemonicWordCountSelectModal
        visible={wordCountPicker.visible}
        selectedWordCount={wordCountPicker.draft}
        onChange={wordCountPicker.setDraft}
        onSelect={wordCountPicker.select}
        onCancel={wordCountPicker.cancel}
      />
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
