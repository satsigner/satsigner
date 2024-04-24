import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'

import SSButton from '@/components/SSButton'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'

export default function AccountOptions() {
  const router = useRouter()
  const accountStore = useAccountStore()

  const [scriptVersion, setScriptVersion] =
    useState<Account['scriptVersion']>('P2WPKH')
  const [seedWordCount, setSeedWordCount] =
    useState<Account['seedWordCount']>(24)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [seedWordCountModalVisible, setSeedWordCountModalVisibile] =
    useState(false)

  function getScriptVersionButtonLabel() {
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

  function getSeedWordCountButtonLabel() {
    if (seedWordCount === 12)
      return `12 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (seedWordCount === 15)
      return `15 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (seedWordCount === 18)
      return `18 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (seedWordCount === 21)
      return `21 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (seedWordCount === 24)
      return `24 ${i18n.t('bitcoin.words').toLowerCase()}`

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
    accountStore.currentAccount.scriptVersion = scriptVersion
    accountStore.currentAccount.seedWordCount = seedWordCount

    const accountCreationType = accountStore.currentAccount.accountCreationType

    if (accountCreationType === 'generate')
      router.push('/addMasterKey/generateSeed')
    else if (accountCreationType === 'import')
      router.push('/addMasterKey/importSeed')
  }

  function handleOnSelectScriptVersion() {
    accountStore.currentAccount.scriptVersion = scriptVersion
    setScriptVersionModalVisible(false)
  }

  function handleOnSelectSeedWordCount() {
    accountStore.currentAccount.seedWordCount = seedWordCount
    setSeedWordCountModalVisibile(false)
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
      <SSVStack justifyBetween>
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
            <SSButton
              label={getScriptVersionButtonLabel()}
              withSelect
              onPress={() => setScriptVersionModalVisible(true)}
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.mnemonic')}
            />
            <SSButton
              label={getSeedWordCountButtonLabel()}
              withSelect
              onPress={() => setSeedWordCountModalVisibile(true)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
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
      <SSSelectModal
        visible={scriptVersionModalVisible}
        title={i18n.t('addMasterKey.accountOptions.scriptVersion')}
        selectedText={`${scriptVersion} - ${i18n.t(
          `addMasterKey.accountOptions.scriptVersions.${scriptVersion?.toLowerCase()}`
        )}`}
        selectedDescription=""
        onSelect={() => handleOnSelectScriptVersion()}
        onCancel={() => setScriptVersionModalVisible(false)}
      >
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.p2pkh'
          )} (P2PKH)`}
          selected={scriptVersion === 'P2PKH'}
          onPress={() => setScriptVersion('P2PKH')}
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.p2sh-p2wpkh'
          )} (P2SH-P2WPKH)`}
          selected={scriptVersion === 'P2SH-P2WPKH'}
          onPress={() => setScriptVersion('P2SH-P2WPKH')}
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.p2wpkh'
          )} (P2WPKH)`}
          selected={scriptVersion === 'P2WPKH'}
          onPress={() => setScriptVersion('P2WPKH')}
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.p2tr'
          )} (P2TR)`}
          selected={false}
          disabled
        />
      </SSSelectModal>
      <SSSelectModal
        visible={seedWordCountModalVisible}
        title={i18n.t('addMasterKey.accountOptions.mnemonic')}
        selectedText={`${seedWordCount} ${i18n.t('bitcoin.words')}`}
        selectedDescription={i18n.t(
          `addMasterKey.accountOptions.mnemonics.${seedWordCount}`
        )}
        onSelect={() => handleOnSelectSeedWordCount()}
        onCancel={() => setSeedWordCountModalVisibile(false)}
      >
        <SSRadioButton
          label={`24 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={seedWordCount === 24}
          onPress={() => setSeedWordCount(24)}
        />
        <SSRadioButton
          label={`21 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={seedWordCount === 21}
          onPress={() => setSeedWordCount(21)}
        />
        <SSRadioButton
          label={`18 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={seedWordCount === 18}
          onPress={() => setSeedWordCount(18)}
        />
        <SSRadioButton
          label={`15 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={seedWordCount === 15}
          onPress={() => setSeedWordCount(15)}
        />
        <SSRadioButton
          label={`12 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={seedWordCount === 12}
          onPress={() => setSeedWordCount(12)}
        />
      </SSSelectModal>
    </SSMainLayout>
  )
}
