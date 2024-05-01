import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'

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
  const accountStore = useAccountStore()

  const [checksumValid, setChecksumValid] = useState(true)

  async function handleUpdatePassphrase(passphrase: string) {
    if (!accountStore.currentAccount.seedWords) return

    const checksumValid = await accountStore.validateMnemonic(
      accountStore.currentAccount.seedWords
    )

    if (checksumValid)
      await accountStore.updateFingerprint(
        accountStore.currentAccount.seedWords,
        passphrase
      )

    setChecksumValid(checksumValid)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{accountStore.currentAccount.name}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack justifyBetween>
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={i18n.t('addMasterKey.accountOptions.mnemonic')}
              />
              {accountStore.currentAccount.seedWordCount && (
                <SSSeedLayout count={accountStore.currentAccount.seedWordCount}>
                  {[...Array(accountStore.currentAccount.seedWordCount)].map(
                    (_, index) => (
                      <SSWordInput
                        key={index}
                        position={index + 1}
                        value={
                          accountStore.currentAccount.seedWords
                            ? accountStore.currentAccount.seedWords[index]
                            : ''
                        }
                        editable={false}
                      />
                    )
                  )}
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
                {accountStore.currentAccount.fingerprint && (
                  <SSFingerprint
                    value={accountStore.currentAccount.fingerprint}
                  />
                )}
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={i18n.t('addMasterKey.generateNewSeed.action')}
              variant="secondary"
              disabled={!checksumValid}
              onPress={() => router.push('/addMasterKey/confirmSeed/0')}
            />
            <SSButton
              label={i18n.t('common.cancel')}
              variant="ghost"
              onPress={() => router.replace('/accountList/')}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
