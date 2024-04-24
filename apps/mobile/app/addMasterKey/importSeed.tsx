import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSChecksumStatus from '@/components/SSChecksumStatus'
import SSFingerprint from '@/components/SSFingerprint'
import SSGradientModal from '@/components/SSGradientModal'
import SSSeparator from '@/components/SSSeparator'
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
import { Colors } from '@/styles'

export default function ImportSeed() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [accountAddedModalVisible, setAccountAddedModalVisible] = useState(true)

  async function handleOnPressImportSeed() {
    //
  }

  async function handleOnCloseAccountAddedModal() {
    setAccountAddedModalVisible(false)
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
                      <SSWordInput key={index} position={index + 1} />
                    )
                  )}
                </SSSeedLayout>
              )}
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label
                label={`${i18n.t('bitcoin.passphrase')} (${i18n.t('common.optional')})`}
              />
              <SSTextInput />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSHStack justifyBetween>
                <SSChecksumStatus valid />
                <SSFingerprint value="1ca1f438" />
              </SSHStack>
            </SSFormLayout.Item>
          </SSFormLayout>
          <SSVStack>
            <SSButton
              label={i18n.t('addMasterKey.importExistingSeed.action')}
              variant="secondary"
              onPress={() => handleOnPressImportSeed()}
            />
            <SSButton
              label={i18n.t('common.cancel')}
              variant="ghost"
              onPress={() => router.replace('/accountList/')}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSGradientModal
        visible={accountAddedModalVisible}
        onClose={() => handleOnCloseAccountAddedModal()}
      >
        <SSVStack style={{ marginVertical: 32, width: '100%' }}>
          <SSVStack itemsCenter gap="xs">
            <SSText color="white" size="2xl">
              {accountStore.currentAccount.name}
            </SSText>
            <SSText color="muted" size="lg">
              {i18n.t('addMasterKey.importExistingSeed.accountAdded')}
            </SSText>
          </SSVStack>
          <SSSeparator />
          <SSHStack justifyEvenly>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t('bitcoin.script')}
              </SSText>
              <SSText size="md" color="muted">
                {i18n.t('bitcoin.script')} Name
              </SSText>
            </SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t('bitcoin.fingerprint')}
              </SSText>
              <SSText size="md" color="muted">
                62e407ad
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSSeparator />
          <SSVStack>
            <SSVStack itemsCenter>
              <SSText style={{ color: Colors.gray[500] }}>
                {i18n.t(
                  'addMasterKey.importExistingSeed.accountAddedModal.derivationPath'
                )}
              </SSText>
              <SSText size="md" color="muted">
                m/84'/1'/0'
              </SSText>
            </SSVStack>
            <SSHStack justifyEvenly>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {i18n.t(
                    'addMasterKey.importExistingSeed.accountAddedModal.utxos'
                  )}
                </SSText>
                <SSText size="md" color="muted">
                  0
                </SSText>
              </SSVStack>
              <SSVStack itemsCenter>
                <SSText style={{ color: Colors.gray[500] }}>
                  {i18n.t(
                    'addMasterKey.importExistingSeed.accountAddedModal.sats'
                  )}
                </SSText>
                <SSText size="md" color="muted">
                  0
                </SSText>
              </SSVStack>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSGradientModal>
    </SSMainLayout>
  )
}
