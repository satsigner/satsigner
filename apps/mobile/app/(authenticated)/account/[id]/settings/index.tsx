import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconScriptsP2pkh, SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSCollapsible from '@/components/SSCollapsible'
import SSLink from '@/components/SSLink'
import SSModal from '@/components/SSModal'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { Account } from '@/types/models/Account'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import { formatDate } from '@/utils/format'

export default function AccountSettings() {
  const { id: currentAccount } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountName, deleteAccount, decryptSeed] =
    useAccountsStore(
      useShallow((state) => [
        state.accounts.find((_account) => _account.name === currentAccount),
        state.updateAccountName,
        state.deleteAccount,
        state.decryptSeed
      ])
    )

  const [scriptVersion, setScriptVersion] =
    useState<Account['scriptVersion']>('P2WPKH')
  const [network, setNetwork] = useState<NonNullable<string>>('signet')
  const [accountName, setAccountName] = useState<Account['name']>(
    currentAccount!
  )

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [networkModalVisible, setNetworkModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [seedModalVisible, setSeedModalVisible] = useState(false)
  const [seed, setSeed] = useState('')

  function getScriptVersionButtonLabel() {
    if (scriptVersion === 'P2PKH') return `${t('script.p2pkh.name')} (P2PKH)`
    else if (scriptVersion === 'P2SH-P2WPKH')
      return `${t('script.p2sh-p2wpkh.name')} (P2SH-P2WPKH)`
    else if (scriptVersion === 'P2WPKH')
      return `${t('script.p2wpkh.name')} (P2WPKH)`
    else if (scriptVersion === 'P2TR') return `${t('script.p2tr.name')} (P2TR)`

    return ''
  }

  function handleOnSelectScriptVersion() {
    setScriptVersion(scriptVersion)
    setScriptVersionModalVisible(false)
  }

  async function saveChanges() {
    updateAccountName(currentAccount!, accountName)
    router.replace(`/account/${accountName}/`)
  }

  function deleteThisAccount() {
    deleteAccount(accountName)
    router.replace('/')
  }

  useEffect(() => {
    async function updateSeed() {
      const seed = await decryptSeed(currentAccount!)
      if (seed) setSeed(seed)
    }
    updateSeed()
  }, [currentAccount, decryptSeed])

  if (!currentAccount || !account) return <Redirect href="/" />

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
            {account && account.createdAt && (
              <SSText>{formatDate(account.createdAt)}</SSText>
            )}
          </SSHStack>
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="VIEW SEED"
              onPress={() => setSeedModalVisible(true)}
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT LABELS"
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccount}/settings/labelExport`
                )
              }
            />
            <SSButton
              style={{ flex: 1 }}
              label="IMPORT LABELS"
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccount}/settings/labelImport`
                )
              }
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
              onPress={() =>
                router.navigate(
                  `/account/${currentAccount}/settings/descriptorsExport`
                )
              }
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
              label={t('addMasterKey.accountOptions.policyType')}
            />
            <SSButton
              label={t(
                'addMasterKey.accountOptions.policyTypes.singleSignature'
              )}
              withSelect
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={t('addMasterKey.accountOptions.scriptVersion')}
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
        title={t('addMasterKey.accountOptions.scriptVersion')}
        selectedText={`${scriptVersion} - ${t(
          `addMasterKey.accountOptions.scriptVersions.names.${scriptVersion?.toLowerCase()}`
        )}`}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {t(
                `addMasterKey.accountOptions.scriptVersions.descriptions.${scriptVersion?.toLowerCase()}.0`
              )}
              <SSLink
                size="md"
                text={t(
                  `addMasterKey.accountOptions.scriptVersions.links.name.${scriptVersion?.toLowerCase()}`
                )}
                url={t(
                  `addMasterKey.accountOptions.scriptVersions.links.url.${scriptVersion?.toLowerCase()}`
                )}
              />
              {t(
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
          label={`${t(
            'addMasterKey.accountOptions.scriptVersions.names.p2pkh'
          )} (P2PKH)`}
          selected={scriptVersion === 'P2PKH'}
          onPress={() => setStateWithLayoutAnimation(setScriptVersion, 'P2PKH')}
        />
        <SSRadioButton
          label={`${t(
            'addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh'
          )} (P2SH-P2WPKH)`}
          selected={scriptVersion === 'P2SH-P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2SH-P2WPKH')
          }
        />
        <SSRadioButton
          label={`${t(
            'addMasterKey.accountOptions.scriptVersions.names.p2wpkh'
          )} (P2WPKH)`}
          selected={scriptVersion === 'P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2WPKH')
          }
        />
        <SSRadioButton
          label={`${t(
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
      <SSModal
        visible={seedModalVisible}
        onClose={() => setSeedModalVisible(false)}
      >
        {seed && (
          <SSVStack gap="lg">
            <SSText center size="xl" weight="bold" uppercase>
              {account.seedWordCount} words
            </SSText>
            <SSHStack style={{ justifyContent: 'center' }}>
              <SSIconWarning
                width={32}
                height={32}
                fill="black"
                stroke="yellow"
              />
              <SSText uppercase weight="bold" size="lg">
                Keep it secret
              </SSText>
              <SSIconWarning
                width={32}
                height={32}
                fill="black"
                stroke="yellow"
              />
            </SSHStack>
            <SSHStack style={{ flexWrap: 'wrap' }}>
              {seed.split(',').map((word, index) => (
                <SSText
                  key={word}
                  style={{ width: '30%' }}
                  type="mono"
                  size="lg"
                >
                  {(index + 1).toString().padStart(2, '0')}. {word}
                </SSText>
              ))}
            </SSHStack>
            <SSTextClipboard text={seed.replaceAll(',', ' ')}>
              <SSButton label="Copy" />
            </SSTextClipboard>
          </SSVStack>
        )}
        {!seed && <SSText>Unable to decrypt seed</SSText>}
      </SSModal>
    </ScrollView>
  )
}
