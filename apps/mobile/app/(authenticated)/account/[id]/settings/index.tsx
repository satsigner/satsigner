import { i18n } from '@/locales'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import SSCollapsible from '@/components/SSCollapsible'
import SSLink from '@/components/SSLink'
import { SSIconScriptsP2pkh } from '@/components/icons'
import SSRadioButton from '@/components/SSRadioButton'
import SSButton from '@/components/SSButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { Account } from '@/types/models/Account'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSModal from '@/components/SSModal'
import { formatDate } from '@/utils/format'
import { formatTransactionLabels, formatUtxoLabels } from '@/utils/bip329'
import { shareFile } from '@/utils/filesystem'
import { pickFile } from '@/utils/filesystem'

export default function AccountSettings() {
  const { id: currentAccount } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountName, deleteAccount] = useAccountsStore(
    (state) => [
      state.accounts.find((_account) => _account.name === currentAccount),
      state.updateAccountName,
      state.deleteAccount
    ]
  )

  const [scriptVersion, setScriptVersion] =
    useState<NonNullable<Account['scriptVersion']>>('P2WPKH')
  const [network, setNetwork] = useState<NonNullable<string>>('signet')
  const [accountName, setAccountName] =
    useState<NonNullable<Account['name']>>(currentAccount)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [networkModalVisible, setNetworkModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)

  function getScriptVersionButtonLabel() {
    if (scriptVersion === 'P2PKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2pkh')} (P2PKH)`
    else if (scriptVersion === 'P2SH-P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh')} (P2SH-P2WPKH)`
    else if (scriptVersion === 'P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2wpkh')} (P2WPKH)`
    else if (scriptVersion === 'P2TR')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2tr')} (P2TR)`

    return ''
  }

  function handleOnSelectScriptVersion() {
    setScriptVersion(scriptVersion)
    setScriptVersionModalVisible(false)
  }

  async function saveChanges() {
    updateAccountName(currentAccount, accountName)
    router.replace(`/account/${accountName}/`)
  }

  function deleteThisAccount() {
    deleteAccount(accountName)
    router.replace('/')
  }

  async function exportLabels() {
    if (!account) return
    const labels = [
      ...formatTransactionLabels(account.transactions),
      ...formatUtxoLabels(account.utxos),
    ]
    const date = (new Date()).toISOString().slice(0, -5)
    const filename = `labels_${accountName}_${date}.json`
    shareFile({
      filename: filename,
      fileContent: JSON.stringify(labels),
      dialogTitle: "Save Labels file",
      mimeType: "application/json",
    })
  }

  async function importLabels() {
    const fileContent = await pickFile({ type: 'application/json' })
    const labels = JSON.parse(fileContent)
    // TODO: add labels to transactions and utxos
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{currentAccount}</SSText>,
          headerRight: () => null
        }}
      />
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          Master Key Settings and Tools
        </SSText>
        <SSVStack itemsCenter gap="none">
          <SSHStack gap="sm">
            <SSText color="muted">Fingerprint</SSText>
            <SSText style={{ color: Colors.success }}>
              {account?.fingerprint}
            </SSText>
          </SSHStack>
          <SSHStack gap="sm">
            <SSText color="muted">Created on</SSText>
            <SSText>{account && formatDate(account.createdAt)}</SSText>
          </SSHStack>
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton style={{ flex: 1 }} label="VIEW SEED" />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT LABELS"
              variant="gradient"
              onPress={exportLabels}
            />
            <SSButton
              style={{ flex: 1 }}
              label="IMPORT LABELS"
              variant="gradient"
              onPress={importLabels}
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="REPLACE KEY"
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT CONFIG"
              variant="gradient"
            />
          </SSHStack>
        </SSVStack>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label label="Account Name" />
            <SSTextInput value={accountName} onChangeText={setAccountName} />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label="Network" />
            <SSButton
              label={network}
              withSelect
              onPress={() => setNetworkModalVisible(true)}
            />
          </SSFormLayout.Item>
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
        </SSFormLayout>
        <SSVStack style={{ marginTop: 60 }}>
          <SSButton label="DUPLICATE MASTER KEY" />
          <SSButton
            label="DELETE MASTER KEY"
            style={{
              backgroundColor: Colors.error
            }}
            onPress={() => setDeleteModalVisible(true)}
          />
          <SSButton label="SAVE" variant="secondary" onPress={saveChanges} />
        </SSVStack>
      </SSVStack>
      <SSSelectModal
        visible={scriptVersionModalVisible}
        title={i18n.t('addMasterKey.accountOptions.scriptVersion')}
        selectedText={`${scriptVersion} - ${i18n.t(
          `addMasterKey.accountOptions.scriptVersions.names.${scriptVersion?.toLowerCase()}`
        )}`}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {i18n.t(
                `addMasterKey.accountOptions.scriptVersions.descriptions.${scriptVersion?.toLowerCase()}.0`
              )}
              <SSLink
                size="md"
                text={i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.links.name.${scriptVersion?.toLowerCase()}`
                )}
                url={i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.links.url.${scriptVersion?.toLowerCase()}`
                )}
              />
              {i18n.t(
                `addMasterKey.accountOptions.scriptVersions.descriptions.${scriptVersion?.toLowerCase()}.1`
              )}
            </SSText>
            <SSIconScriptsP2pkh height={80} width="100%" />
          </SSCollapsible>
        }
        onSelect={() => handleOnSelectScriptVersion()}
        onCancel={() => setScriptVersionModalVisible(false)}
      >
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2pkh'
          )} (P2PKH)`}
          selected={scriptVersion === 'P2PKH'}
          onPress={() => setStateWithLayoutAnimation(setScriptVersion, 'P2PKH')}
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh'
          )} (P2SH-P2WPKH)`}
          selected={scriptVersion === 'P2SH-P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2SH-P2WPKH')
          }
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2wpkh'
          )} (P2WPKH)`}
          selected={scriptVersion === 'P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2WPKH')
          }
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2tr'
          )} (P2TR)`}
          selected={scriptVersion === 'P2TR'}
          onPress={() => setStateWithLayoutAnimation(setScriptVersion, 'P2TR')}
        />
      </SSSelectModal>
      <SSSelectModal
        visible={networkModalVisible}
        title="Network"
        selectedText={network.toUpperCase()}
        selectedDescription={`Use the ${network} network.`}
        onSelect={() => setNetworkModalVisible(false)}
        onCancel={() => setNetworkModalVisible(false)}
      >
        <SSRadioButton
          label="MainNet"
          selected={network === 'bitcoin'}
          onPress={() => setNetwork('bitcoin')}
        />
        <SSRadioButton
          label="SigNet"
          selected={network === 'signet'}
          onPress={() => setNetwork('signet')}
        />
        <SSRadioButton
          label="Testnet"
          selected={network === 'testnet'}
          onPress={() => setNetwork('testnet')}
        />
      </SSSelectModal>
      <SSModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
      >
        <SSVStack
          style={{
            padding: 0,
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <SSText size="xl" weight="bold">
            Are you sure?
          </SSText>
          <SSHStack style={{ flexWrap: 'wrap' }}>
            <SSButton
              label="YES"
              style={{
                backgroundColor: Colors.error
              }}
              onPress={() => {
                deleteThisAccount()
              }}
            />
            <SSButton
              label="NO"
              onPress={() => {
                setDeleteModalVisible(false)
              }}
            />
          </SSHStack>
        </SSVStack>
      </SSModal>
    </ScrollView>
  )
}
