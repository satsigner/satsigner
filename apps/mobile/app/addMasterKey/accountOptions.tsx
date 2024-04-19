import { Stack, useRouter } from 'expo-router'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'

export default function AccountOptions() {
  const router = useRouter()
  const accountStore = useAccountStore()

  function getScriptVersionButtonLabel() {
    const scriptVersion = accountStore.currentAccount.scriptVersion

    if (scriptVersion === 'P2PKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.p2pkh')} (P2PKH)`
    else if (scriptVersion === 'P2SH-P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.p2sh-p2wpkh')} (P2SH-P2WPKH)`
    else if (scriptVersion === 'P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.p2wpkh')} (P2WPKH)`
    else if (scriptVersion === 'P2TR')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.p2tr')} P2TR`

    return ''
  }

  function getContinueButtonLabel() {
    const accountCreationType = accountStore.currentAccount.accountCreationType

    if (accountCreationType === 'generate')
      return i18n.t('addMasterKey.accountOptions.generateNewSeed')
    else if (accountCreationType === 'import')
      return i18n.t('addMasterKey.accountOptions.importSeed')

    return ''
  }

  function handleOnPressConfirmAccountOptions() {
    const accountCreationType = accountStore.currentAccount.accountCreationType

    if (accountCreationType === 'generate')
      router.push('/addMasterKey/generateSeed')
    else if (accountCreationType === 'import')
      router.push('/addMasterKey/importSeed')
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
      <SSVStack>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.policyType')}
            />
            <SSButton
              label={i18n.t(
                'addMasterKey.accountOptions.policyTypes.singleSignature'
              )}
              withSelect
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.scriptVersion')}
            />
            <SSButton label={getScriptVersionButtonLabel()} withSelect />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.mnmonic')}
            />
            <SSButton label="" withSelect />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack justifyEnd>
          <SSButton
            label={getContinueButtonLabel()}
            variant="secondary"
            onPress={() => handleOnPressConfirmAccountOptions()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.navigate('/accountList/')}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
