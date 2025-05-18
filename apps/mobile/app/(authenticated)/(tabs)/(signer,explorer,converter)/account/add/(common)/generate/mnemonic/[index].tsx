import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getFingerprint, validateMnemonic } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSWordInput from '@/components/SSWordInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { type GenerateMnemonicSearchParams } from '@/types/navigation/searchParams'

export default function GenerateMnemonic() {
  const { index } = useLocalSearchParams<GenerateMnemonicSearchParams>()
  const router = useRouter()
  const [
    name,
    mnemonicWordCount,
    mnemonic,
    fingerprint,
    policyType,
    setPassphrase,
    setFingerprint,
    setKey
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.mnemonicWordCount,
      state.mnemonic.split(' '),
      state.fingerprint,
      state.policyType,
      state.setPassphrase,
      state.setFingerprint,
      state.setKey
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [checksumValid, setChecksumValid] = useState(true)

  // TODO: Debounce this
  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const validMnemonic = await validateMnemonic(mnemonic.join(' '))
    setChecksumValid(validMnemonic)

    if (checksumValid) {
      const fingerprint = await getFingerprint(
        mnemonic.join(' '),
        passphrase,
        network as Network
      )
      setFingerprint(fingerprint)
    }
  }

  function handleOnPressCancel() {
    if (policyType === 'multisig') router.back()
    else if (policyType === 'singlesig') router.dismissAll()
  }

  function handleOnPressConfirm() {
    setKey(Number(index))
    router.navigate(`/account/add/confirm/${index}/word/0`)
  }

  if (mnemonic.length !== mnemonicWordCount) return <Redirect href="/" />

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.mnemonic.title')} />
              <SSSeedLayout count={mnemonicWordCount}>
                {[...Array(mnemonicWordCount)].map((_, index) => (
                  <SSWordInput
                    key={index}
                    position={index + 1}
                    value={mnemonic ? mnemonic[index] : ''}
                    editable={false}
                    index={index}
                  />
                ))}
              </SSSeedLayout>
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={`${t('bitcoin.passphrase')} (${t('common.optional')})`}
              />
              <SSTextInput
                onChangeText={(text) => handleUpdatePassphrase(text)}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid={checksumValid} />
                {fingerprint && <SSFingerprint value={fingerprint} />}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={t('account.confirmSeed.title')}
              variant="secondary"
              disabled={!checksumValid}
              onPress={handleOnPressConfirm}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleOnPressCancel}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
