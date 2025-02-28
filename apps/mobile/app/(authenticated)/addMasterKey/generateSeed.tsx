import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { validateMnemonic } from '@/api/bdk'
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

export default function GenerateSeed() {
  const router = useRouter()
  const [
    name,
    seedWordCount,
    seedWords,
    fingerprint,
    setPassphrase,
    updateFingerprint
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.seedWordCount,
      state.seedWords.split(' '),
      state.fingerprint,
      state.setPassphrase,
      state.updateFingerprint
    ])
  )

  const [checksumValid, setChecksumValid] = useState(true)

  async function handleUpdatePassphrase(passphrase: string) {
    setPassphrase(passphrase)

    const checksumValid = await validateMnemonic(seedWords.join(' '))
    setChecksumValid(checksumValid)

    if (checksumValid) await updateFingerprint()
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
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.mnemonic.title')} />
              {seedWordCount && (
                <SSSeedLayout count={seedWordCount}>
                  {[...Array(seedWordCount)].map((_, index) => (
                    <SSWordInput
                      key={index}
                      position={index + 1}
                      value={seedWords ? seedWords[index] : ''}
                      editable={false}
                      index={index}
                    />
                  ))}
                </SSSeedLayout>
              )}
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
              onPress={() => router.navigate('/addMasterKey/confirmSeed/0')}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => router.replace('/')}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
