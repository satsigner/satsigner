import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconEyeOn, SSIconScriptsP2pkh } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSTextClipboard from '@/components/SSClipboardCopy'
import SSCollapsible from '@/components/SSCollapsible'
import SSLink from '@/components/SSLink'
import SSModal from '@/components/SSModal'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSMultisigKeyControl from '@/components/SSMultisigKeyControl'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { PIN_KEY } from '@/config/auth'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSSeedLayout from '@/layouts/SSSeedLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import { aesDecrypt } from '@/utils/crypto'
import { formatDate } from '@/utils/format'

export default function AccountSettings() {
  const { id: currentAccountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccountName, deleteAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === currentAccountId),
      state.updateAccountName,
      state.deleteAccount
    ])
  )
  const removeAccountWallet = useWalletsStore(
    (state) => state.removeAccountWallet
  )

  const [scriptVersion, setScriptVersion] =
    useState<Key['scriptVersion']>('P2WPKH') // TODO: use current account script
  const [network, setNetwork] = useState<NonNullable<string>>('signet')
  const [accountName, setAccountName] = useState<Account['name']>(
    account?.name || ''
  )
  const [localMnemonic, setLocalMnemonic] = useState('')

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [networkModalVisible, setNetworkModalVisible] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [mnemonicModalVisible, setMnemonicModalVisible] = useState(false)

  function getPolicyTypeButtonLabel() {
    switch (account?.policyType) {
      case 'singlesig':
        return t('account.policy.singleSignature.title')
      case 'multisig':
        return t('account.policy.multiSignature.title')
      case 'watchonly':
        return t('account.policy.watchOnly.title')
      default:
        return ''
    }
  }

  function handleOnSelectScriptVersion() {
    setScriptVersion(scriptVersion)
    setScriptVersionModalVisible(false)
  }

  async function saveChanges() {
    updateAccountName(currentAccountId!, accountName)
    router.replace(`/account/${currentAccountId}/`)
  }

  function deleteThisAccount() {
    deleteAccount(currentAccountId!)
    removeAccountWallet(currentAccountId!)
    router.replace('/')
  }

  useEffect(() => {
    async function getMnemonic() {
      const pin = await getItem(PIN_KEY)
      if (!account || !pin) return

      const iv = account.keys[0].iv
      const encryptedSecret = account.keys[0].secret as string

      const accountSecretString = await aesDecrypt(encryptedSecret, pin, iv)
      const accountSecret = JSON.parse(accountSecretString) as Secret

      setLocalMnemonic(accountSecret.mnemonic || '')
    }
    getMnemonic()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentAccountId || !account || !scriptVersion)
    return <Redirect href="/" />

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack gap="sm">
              <SSText uppercase>{account.name}</SSText>
              {account.policyType === 'watchonly' && (
                <SSIconEyeOn stroke="#fff" height={16} width={16} />
              )}
            </SSHStack>
          ),
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
              {account.keys[0].fingerprint}
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
          {(account.keys[0].creationType === 'generateMnemonic' ||
            account.keys[0].creationType === 'importMnemonic') && (
            <SSHStack>
              <SSButton
                style={{ flex: 1 }}
                label={t('account.viewMnemonic')}
                onPress={() => setMnemonicModalVisible(true)}
              />
            </SSHStack>
          )}
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label={t('account.export.descriptors')}
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/export/descriptors`
                )
              }
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label={t('account.export.labels')}
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/export/labels`
                )
              }
            />
            <SSButton
              style={{ flex: 1 }}
              label={t('account.import.labels')}
              variant="gradient"
              onPress={() =>
                router.navigate(
                  `/account/${currentAccountId}/settings/import/labels`
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
            <SSButton label={getPolicyTypeButtonLabel()} withSelect />
          </SSFormLayout.Item>
          {account.policyType === 'singlesig' && (
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.script')} />
              <SSButton
                label={`${t(`script.${scriptVersion.toLocaleLowerCase()}.name`)} (${scriptVersion})`}
                withSelect
                onPress={() => setScriptVersionModalVisible(true)}
              />
            </SSFormLayout.Item>
          )}
        </SSFormLayout>
        {account.policyType === 'multisig' && (
          <>
            <SSVStack
              style={{ backgroundColor: '#131313', paddingHorizontal: 16 }}
              gap="md"
            >
              <SSMultisigCountSelector
                maxCount={12}
                requiredNumber={account.keysRequired!}
                totalNumber={account.keyCount!}
                viewOnly
              />
              <SSText center>{t('account.addOrGenerateKeys')}</SSText>
            </SSVStack>
            <SSVStack gap="none" style={{ marginHorizontal: -20 }}>
              {account.keys.map((key, index) => (
                <SSMultisigKeyControl
                  key={index}
                  isBlackBackground={index % 2 === 1}
                  index={index}
                  keyCount={account.keyCount}
                  keyDetails={key}
                />
              ))}
            </SSVStack>
          </>
        )}
        <SSVStack style={{ marginTop: 60 }}>
          <SSButton label={t('account.duplicate.title')} />
          <SSButton
            label={t('account.delete.title')}
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
          `script.${scriptVersion.toLowerCase()}.name`
        )}`}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {t(`script.${scriptVersion?.toLowerCase()}.description.1`)}
              <SSLink
                size="md"
                text={t(`script.${scriptVersion.toLowerCase()}.link.name`)}
                url={t(`script.${scriptVersion.toLowerCase()}.link.url`)}
              />
              {t(`script.${scriptVersion.toLowerCase()}.description.2`)}
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
        fullOpacity
        visible={mnemonicModalVisible}
        onClose={() => setMnemonicModalVisible(false)}
        label={t('common.close')}
        variant="subtle"
      >
        {localMnemonic && (
          <SSVStack gap="lg" itemsCenter>
            <SSText center uppercase>
              {account.keys[0].mnemonicWordCount} {t('account.mnemonic.title')}
            </SSText>
            <SSHStack style={{ justifyContent: 'center' }}>
              <SSText uppercase color="muted">
                {t('account.seed.keepItSecret')}
              </SSText>
            </SSHStack>
            <SSHStack>
              {account.keys[0].mnemonicWordCount && (
                <SSSeedLayout count={account.keys[0].mnemonicWordCount}>
                  {localMnemonic.split(' ').map((word, index) => (
                    <View
                      key={index}
                      style={{
                        height: 46,
                        width: '32%',
                        justifyContent: 'center'
                      }}
                    >
                      <SSHStack
                        gap="sm"
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          borderColor: Colors.gray[800],
                          borderWidth: 1
                        }}
                      >
                        <SSText size="md" color="muted">
                          {(index + 1).toString().padStart(2, '0')}.
                        </SSText>
                        <SSText size="md">{word}</SSText>
                      </SSHStack>
                    </View>
                  ))}
                </SSSeedLayout>
              )}
            </SSHStack>
            <SSHStack>
              <SSTextClipboard text={localMnemonic.replaceAll(',', ' ')}>
                <SSButton variant="secondary" label={t('common.copy')} />
              </SSTextClipboard>
            </SSHStack>
          </SSVStack>
        )}
        {!localMnemonic && <SSText>{t('account.seed.unableToDecrypt')}</SSText>}
      </SSModal>
    </ScrollView>
  )
}
