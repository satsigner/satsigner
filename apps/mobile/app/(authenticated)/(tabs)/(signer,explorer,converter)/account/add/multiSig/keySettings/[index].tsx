import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import { ENTROPY_TYPES } from '@/config/entropy'
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
    setMnemonic,
    setFingerprint,
    setCreationType,
    setNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.keyCount,
      state.setEntropy,
      state.setMnemonicWordCount,
      state.setMnemonic,
      state.setFingerprint,
      state.setCreationType,
      state.setNetwork
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [localEntropyType, setLocalEntropyType] = useState<EntropyType>('none')
  const [localMnemonicWordCount, setLocalMnemonicWordCount] =
    useState<NonNullable<Key['mnemonicWordCount']>>(24)
  // TODO: add support for multi-lang word list

  const [entropyModalVisible, setEntropyModalVisible] = useState(false)
  const [mnemonicWordCountModalVisible, setMnemonicWordCountModalVisibile] =
    useState(false)

  const [loading, setLoading] = useState(false)

  async function handleOnPress(type: NonNullable<Key['creationType']>) {
    setCreationType(type)
    setEntropy(localEntropyType)
    setMnemonicWordCount(localMnemonicWordCount)
    setNetwork(network)

    if (type === 'generateMnemonic') {
      switch (localEntropyType) {
        case 'none': {
          setLoading(true)

          // TODO: add support for multi-lang word list
          const mnemonic = generateMnemonic(localMnemonicWordCount)
          setMnemonic(mnemonic)

          const fingerprint = getFingerprintFromMnemonic(
            mnemonic,
            undefined,
            network as Network
          )
          setFingerprint(fingerprint)

          setLoading(false)
          router.navigate(`/account/add/generate/mnemonic/${index}`)
          break
        }
        case 'drawing': {
          break
        }
        case 'coin': {
          router.navigate({
            pathname: '/account/add/entropy/coin',
            params: { index }
          })
          break
        }
        case 'dice': {
          router.navigate({
            pathname: '/account/add/entropy/dice',
            params: { index }
          })
          break
        }
      }
    }
  }

  function handleOnSelectMnemonicWordCount() {
    setLocalMnemonicWordCount(localMnemonicWordCount)
    setMnemonicWordCountModalVisibile(false)
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
                label={`${localMnemonicWordCount} ${t(
                  'bitcoin.words'
                ).toLowerCase()}`}
                withSelect
                onPress={() => setMnemonicWordCountModalVisibile(true)}
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
