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
import { type Account } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
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
          {t('account.settings.title')}
        </SSText>
        <SSVStack itemsCenter gap="none">
          <SSHStack gap="sm">
            <SSText color="muted">{t('account.fingerprint')}</SSText>
            <SSText style={{ color: Colors.success }}>
              {account?.fingerprint}
            </SSText>
          </SSHStack>
          <SSHStack gap="sm">
            <SSText color="muted">{t('account.createdOn')}</SSText>
            {account && account.createdAt && (
              <SSText>{formatDate(account.createdAt)}</SSText>
            )}
          </SSHStack>
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label={t('account.viewSeed')}
              onPress={() => setSeedModalVisible(true)}
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label={t('account.export.labels')}
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccount}/settings/labelExport`
                )
              }
            />
            <SSButton
              style={{ flex: 1 }}
              label={t('account.import.labels')}
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
              label={t('account.replace.key')}
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label={t('account.export.config')}
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
            <SSFormLayout.Label label={t('account.name')} />
            <SSTextInput value={accountName} onChangeText={setAccountName} />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.network.title')} />
            <SSButton
              label={network}
              withSelect
              onPress={() => setNetworkModalVisible(true)}
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.policy.title')} />
            <SSButton label={t('account.policy.singleSignature')} withSelect />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label label={t('account.script')} />
            <SSButton
              label={getScriptVersionButtonLabel()}
              withSelect
              onPress={() => setScriptVersionModalVisible(true)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack style={{ marginTop: 60 }}>
          <SSButton label={t('account.duplicate.masterKey')} />
          <SSButton
            label={t('account.delete.masterKey')}
            style={{
              backgroundColor: Colors.error
            }}
            onPress={() => setDeleteModalVisible(true)}
          />
          <SSButton
            label={t('common.save')}
            variant="secondary"
            onPress={saveChanges}
          />
        </SSVStack>
      </SSVStack>
      <SSSelectModal
        visible={scriptVersionModalVisible}
        title={t('account.script')}
        selectedText={`${scriptVersion} - ${t(
          `script.${scriptVersion?.toLowerCase()}.name`
        )}`}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {t(`script.${scriptVersion?.toLowerCase()}.description.1`)}
              <SSLink
                size="md"
                text={t(`script.${scriptVersion?.toLowerCase()}.link.name`)}
                url={t(`script.${scriptVersion?.toLowerCase()}.link.url`)}
              />
              {t(`script.${scriptVersion?.toLowerCase()}.description.2`)}
            </SSText>
            <SSIconScriptsP2pkh height={80} width="100%" />
          </SSCollapsible>
        }
        onSelect={() => handleOnSelectScriptVersion()}
        onCancel={() => setScriptVersionModalVisible(false)}
      >
        <SSRadioButton
          label={`${t('script.p2pkh.name')} (P2PKH)`}
          selected={scriptVersion === 'P2PKH'}
          onPress={() => setStateWithLayoutAnimation(setScriptVersion, 'P2PKH')}
        />
        <SSRadioButton
          label={`${t('script.p2sh-p2wpkh.name')} (P2SH-P2WPKH)`}
          selected={scriptVersion === 'P2SH-P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2SH-P2WPKH')
          }
        />
        <SSRadioButton
          label={`${t('script.p2wpkh.name')} (P2WPKH)`}
          selected={scriptVersion === 'P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setScriptVersion, 'P2WPKH')
          }
        />
        <SSRadioButton
          label={`${t('script.p2tr.name')} (P2TR)`}
          selected={scriptVersion === 'P2TR'}
          onPress={() => setStateWithLayoutAnimation(setScriptVersion, 'P2TR')}
        />
      </SSSelectModal>
      <SSSelectModal
        visible={networkModalVisible}
        title={t('account.network.title')}
        selectedText={network.toUpperCase()}
        selectedDescription={t('account.network.description', { network })}
        onSelect={() => setNetworkModalVisible(false)}
        onCancel={() => setNetworkModalVisible(false)}
      >
        <SSRadioButton
          label={t('bitcoin.network.mainnet')}
          selected={network === 'bitcoin'}
          onPress={() => setNetwork('bitcoin')}
        />
        <SSRadioButton
          label={t('bitcoin.network.signet')}
          selected={network === 'signet'}
          onPress={() => setNetwork('signet')}
        />
        <SSRadioButton
          label={t('bitcoin.network.testnet')}
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
            {t('common.areYouSure')}
          </SSText>
          <SSHStack style={{ flexWrap: 'wrap' }}>
            <SSButton
              label={t('common.yes')}
              style={{
                backgroundColor: Colors.error
              }}
              onPress={() => {
                deleteThisAccount()
              }}
            />
            <SSButton
              label={t('common.no')}
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
              {account.seedWordCount} {t('bitcoin.words')}
            </SSText>
            <SSHStack style={{ justifyContent: 'center' }}>
              <SSIconWarning
                width={32}
                height={32}
                fill="black"
                stroke="yellow"
              />
              <SSText uppercase weight="bold" size="lg">
                {t('account.seed.keepItSecret')}
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
              <SSButton label={t('common.copy')} />
            </SSTextClipboard>
          </SSVStack>
        )}
        {!seed && <SSText>{t('account.seed.unableToDecrypt')}</SSText>}
      </SSModal>
    </ScrollView>
  )
}
