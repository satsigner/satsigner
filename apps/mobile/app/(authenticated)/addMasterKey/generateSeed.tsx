import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

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
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function GenerateSeed() {
  const router = useRouter()
  const [
    currentAccount,
    setCurrentAccountPassphrase,
    validateMnemonic,
    updateFingerprint
  ] = useAccountStore(
    useShallow((state) => [
      state.currentAccount,
      state.setCurrentAccountPassphrase,
      state.validateMnemonic,
      state.updateFingerprint
    ])
  )

  const [checksumValid, setChecksumValid] = useState(true)

  async function handleUpdatePassphrase(passphrase: string) {
    if (!currentAccount.seedWords) return
    setCurrentAccountPassphrase(passphrase)

    const checksumValid = await validateMnemonic(currentAccount.seedWords)

    if (checksumValid)
      await updateFingerprint(currentAccount.seedWords, passphrase)

    setChecksumValid(checksumValid)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{currentAccount.name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={i18n.t('addMasterKey.accountOptions.mnemonic')}
              />
              {currentAccount.seedWordCount && (
                <SSSeedLayout count={currentAccount.seedWordCount}>
                  {[...Array(currentAccount.seedWordCount)].map((_, index) => (
                    <SSWordInput
                      key={index}
                      position={index + 1}
                      value={
                        currentAccount.seedWords
                          ? currentAccount.seedWords[index]
                          : ''
                      }
                      editable={false}
                    />
                  ))}
                </SSSeedLayout>
              )}
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={`${i18n.t('bitcoin.passphrase')} (${i18n.t('common.optional')})`}
              />
              <SSTextInput
                onChangeText={(text) => handleUpdatePassphrase(text)}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid={checksumValid} />
                {currentAccount.fingerprint && (
                  <SSFingerprint value={currentAccount.fingerprint} />
                )}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={i18n.t('addMasterKey.generateNewSeed.action')}
              variant="secondary"
              disabled={!checksumValid}
              onPress={() => router.navigate('/addMasterKey/confirmSeed/0')}
            />
            <SSButton
              label={i18n.t('common.cancel')}
              variant="ghost"
              onPress={() => router.replace('/')}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
