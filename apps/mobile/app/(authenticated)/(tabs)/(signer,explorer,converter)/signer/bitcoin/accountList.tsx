import { FlashList } from '@shopify/flash-list'
import { Network as BdkNetwork } from 'bdk-rn/lib/lib/enums'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconGreenIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import SSAccountCard from '@/components/SSAccountCard'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { DEFAULT_PIN, PIN_KEY, SALT_KEY } from '@/config/auth'
import {
  sampleMultiAddressTether,
  sampleSalvadorAddress,
  sampleSegwitAddress,
  sampleSignetAddress,
  sampleSignetMultisigKey1,
  sampleSignetMultisigKey2,
  sampleSignetMultisigKey3Fingerprint,
  sampleSignetMultisigKey3Xpub,
  sampleSignetWalletSeed,
  sampleSignetXpub,
  sampleSignetXpubFingerprint,
  sampleTestnet4Address
} from '@/constants/samples'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useNostrSync from '@/hooks/useNostrSync'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem, setItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Network } from '@/types/settings/blockchain'
import {
  getExtendedPublicKeyFromMnemonic,
  getExtendedPublicKeyFromMnemonicCustom,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import { generateSalt, pbkdf2Encrypt } from '@/utils/crypto'

// Helper function to map local Network type to bdk-rn Network enum
function mapNetworkToBdkNetwork(network: 'bitcoin' | 'testnet' | 'signet') {
  switch (network) {
    case 'bitcoin':
      return BdkNetwork.Bitcoin
    case 'testnet':
      return BdkNetwork.Testnet
    case 'signet':
      return BdkNetwork.Signet
    default:
      return BdkNetwork.Bitcoin
  }
}

export default function AccountList() {
  const router = useRouter()
  const { width } = useWindowDimensions()

  const [network, setSelectedNetwork, connectionMode, mempoolUrl] =
    useBlockchainStore(
      useShallow((state) => [
        state.selectedNetwork,
        state.setSelectedNetwork,
        state.configs[state.selectedNetwork].config.connectionMode,
        state.configsMempool[state.selectedNetwork]
      ])
    )
  const [accounts, updateAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.updateAccount])
  )
  const [
    clearAccount,
    getAccountData,
    setFingerprint,
    setName,
    setScriptVersion,
    setExternalDescriptor,
    setExtendedPublicKey,
    setCreationType,
    setMnemonic,
    setMnemonicWordCount,
    setKeyCount,
    setKeysRequired,
    setPolicyType,
    setKey,
    setNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.clearAccount,
      state.getAccountData,
      state.setFingerprint,
      state.setName,
      state.setScriptVersion,
      state.setExternalDescriptor,
      state.setExtendedPublicKey,
      state.setCreationType,
      state.setMnemonic,
      state.setMnemonicWordCount,
      state.setKeyCount,
      state.setKeysRequired,
      state.setPolicyType,
      state.setKey,
      state.setNetwork
    ])
  )
  const fetchPrices = usePriceStore((state) => state.fetchPrices)
  const [wallets, addresses] = useWalletsStore(
    useShallow((state) => [state.wallets, state.addresses])
  )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { accountBuilderFinish } = useAccountBuilderFinish()
  const { cleanupSubscriptions } = useNostrSync()

  type SampleWallet =
    | 'segwit'
    | 'legacy'
    | 'watchonlyXpub'
    | 'watchonlyAddress'
    | 'watchonlySalvador'
    | 'watchonlySegwit'
    | 'watchonlyTestnet4'
    | 'watchonlyTether'
    | 'multisig'
  const [loadingWallet, setLoadingWallet] = useState<SampleWallet>()

  const tabs = [{ key: 'bitcoin' }, { key: 'testnet' }, { key: 'signet' }]
  const [tabIndex, setTabIndex] = useState(() => {
    const index = tabs.findIndex((tab) => tab.key === network)
    return index > 0 ? index : 0
  })

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => acc.network === tabs[tabIndex].key)
  }, [accounts, tabIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  useEffect(() => {
    const currentNetwork = tabs[tabIndex].key as Network
    if (currentNetwork !== network) {
      setSelectedNetwork(currentNetwork)
    }
  }, [tabIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncAccounts()
  }, [network]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, mempoolUrl])

  useFocusEffect(() => {
    cleanupSubscriptions()
  })

  function handleOnNavigateToAddAccount() {
    clearAccount()
    router.navigate('/signer/bitcoin/account/add')
  }

  function handleGoToAccount(accountId: string) {
    router.navigate(`/signer/bitcoin/account/${accountId}`)
  }

  async function syncAccounts() {
    if (connectionMode !== 'auto') return
    for (const account of accounts) {
      if (account.network !== tabs[tabIndex].key) continue

      const isImportAddress = account.keys[0].creationType === 'importAddress'

      if (isImportAddress && !addresses[account.id]) continue
      if (!isImportAddress && !wallets[account.id]) continue

      if (account.syncStatus !== 'syncing') {
        const updatedAccount =
          account.policyType === 'watchonly' &&
          account.keys[0].creationType === 'importAddress'
            ? await syncAccountWithAddress(account)
            : await syncAccountWithWallet(account, wallets[account.id]!)
        updateAccount(updatedAccount)
      }
    }
    // TO DO: Try Promise.all() method instead Sequential one.
  }

  async function handleLoadSampleWallet(type: SampleWallet) {
    setLoadingWallet(type)
    try {
      await loadSampleWallet(type)
    } catch {
      toast.error('failed to create sample wallet')
    } finally {
      clearAccount()
      setLoadingWallet(undefined)
    }
  }

  async function loadSampleWallet(type: SampleWallet) {
    // Check if PIN is available, if not set a default one
    const pin = await getItem(PIN_KEY)

    // TODO: remove DEFAULT_PIN
    if (!pin) {
      const salt = await generateSalt()
      const encryptedPin = await pbkdf2Encrypt(DEFAULT_PIN, salt)
      await setItem(PIN_KEY, encryptedPin)
      await setItem(SALT_KEY, salt)
    }

    // Verify PIN is accessible
    const verifyPin = await getItem(PIN_KEY)
    if (!verifyPin) {
      throw new Error('Failed to set or retrieve PIN')
    }

    setName(`Sample Wallet (${type})`)
    setKeyCount(1)
    setKeysRequired(1)

    const currentNetwork = tabs[tabIndex].key as Network

    const bdkNetwork = mapNetworkToBdkNetwork(currentNetwork)

    setNetwork(currentNetwork)

    // Also ensure the global blockchain network is set correctly
    if (currentNetwork !== network) {
      setSelectedNetwork(currentNetwork)
    }

    switch (type) {
      case 'segwit': {
        // Generate fingerprint and extended public key from mnemonic
        const fingerprint = getFingerprintFromMnemonic(sampleSignetWalletSeed)
        const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
          sampleSignetWalletSeed,
          '',
          bdkNetwork,
          'P2WPKH'
        )
        setFingerprint(fingerprint)
        setExtendedPublicKey(extendedPublicKey)
        setScriptVersion('P2WPKH')
        setPolicyType('singlesig')
        setCreationType('importMnemonic')
        setMnemonicWordCount(12)
        setMnemonic(sampleSignetWalletSeed)
        break
      }
      case 'legacy': {
        const fingerprint = getFingerprintFromMnemonic(sampleSignetWalletSeed)
        const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
          sampleSignetWalletSeed,
          '',
          bdkNetwork,
          'P2PKH'
        )
        setFingerprint(fingerprint)
        setExtendedPublicKey(extendedPublicKey)
        setScriptVersion('P2PKH')
        setPolicyType('singlesig')
        setCreationType('importMnemonic')
        setMnemonicWordCount(12)
        setMnemonic(sampleSignetWalletSeed)
        break
      }
      case 'watchonlyXpub':
        setScriptVersion('P2PKH')
        setPolicyType('watchonly')
        setCreationType('importExtendedPub')
        setExtendedPublicKey(sampleSignetXpub)
        setFingerprint(sampleSignetXpubFingerprint)
        break
      case 'watchonlyAddress':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        setExternalDescriptor(`addr(${sampleSignetAddress})`)
        break
      case 'watchonlySalvador':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        setExternalDescriptor(`addr(${sampleSalvadorAddress})`)
        break
      case 'watchonlySegwit':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        setExternalDescriptor(`addr(${sampleSegwitAddress})`)
        break
      case 'watchonlyTestnet4':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        setExternalDescriptor(`addr(${sampleTestnet4Address})`)
        break
      case 'watchonlyTether':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        sampleMultiAddressTether.forEach((address, index) => {
          setExternalDescriptor(`addr(${address})`)
          setKey(index)
        })
        break
      case 'multisig': {
        // Set up multisig configuration
        setPolicyType('multisig')
        setScriptVersion('P2WSH')
        setKeyCount(3)
        setKeysRequired(2)

        // Key 1: Mnemonic
        setMnemonic(sampleSignetMultisigKey1)
        setMnemonicWordCount(12)
        setCreationType('importMnemonic')
        const fingerprint1 = getFingerprintFromMnemonic(
          sampleSignetMultisigKey1
        )
        const extendedPublicKey1 = await getExtendedPublicKeyFromMnemonicCustom(
          sampleSignetMultisigKey1,
          '',
          bdkNetwork,
          'P2WSH'
        )
        setFingerprint(fingerprint1)
        setExtendedPublicKey(extendedPublicKey1)
        setKey(0)

        // Key 2: Mnemonic
        setMnemonic(sampleSignetMultisigKey2)
        setMnemonicWordCount(12)
        setCreationType('importMnemonic')
        const fingerprint2 = getFingerprintFromMnemonic(
          sampleSignetMultisigKey2
        )
        const extendedPublicKey2 = await getExtendedPublicKeyFromMnemonicCustom(
          sampleSignetMultisigKey2,
          '',
          bdkNetwork,
          'P2WSH'
        )
        setFingerprint(fingerprint2)
        setExtendedPublicKey(extendedPublicKey2)
        setKey(1)

        // Key 3: Extended Public Key
        setCreationType('importExtendedPub')
        setExtendedPublicKey(sampleSignetMultisigKey3Xpub)
        setFingerprint(sampleSignetMultisigKey3Fingerprint)
        setKey(2)
        break
      }
    }

    if (type !== 'watchonlyTether' && type !== 'multisig') setKey(0)

    const account = getAccountData()

    // Validate account data structure
    if (
      !account.name ||
      !account.network ||
      !account.policyType ||
      account.keys.length === 0
    ) {
      throw new Error('Invalid account data structure')
    }

    if (
      account.keys[0].creationType === 'importMnemonic' &&
      !account.keys[0].secret
    ) {
      throw new Error('Mnemonic secret not properly set')
    }

    // Additional validation for mnemonic-based wallets
    if (['segwit', 'legacy'].includes(type)) {
      const key = account.keys[0]
      if (
        !key.secret ||
        typeof key.secret !== 'object' ||
        !key.secret.mnemonic
      ) {
        throw new Error('Mnemonic not properly set in account key')
      }
      if (!key.scriptVersion) {
        throw new Error('Script version not properly set')
      }
    }

    // Additional validation for multisig wallets
    if (type === 'multisig') {
      if (account.keys.length !== 3) {
        throw new Error('Multisig account must have exactly 3 keys')
      }
      if (account.keyCount !== 3 || account.keysRequired !== 2) {
        throw new Error('Multisig configuration invalid')
      }
      // Validate that first two keys have mnemonic secrets
      for (let i = 0; i < 2; i++) {
        const key = account.keys[i]
        if (
          !key.secret ||
          typeof key.secret !== 'object' ||
          !key.secret.mnemonic
        ) {
          throw new Error(`Mnemonic not properly set in key ${i + 1}`)
        }
      }
      // Validate that third key has extended public key
      const key3 = account.keys[2]
      if (
        !key3.secret ||
        typeof key3.secret !== 'object' ||
        !key3.secret.extendedPublicKey
      ) {
        throw new Error('Extended public key not properly set in key 3')
      }
    }

    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('Wallet creation timed out after 30 seconds')),
        30000
      )
    })

    const data = await Promise.race([
      accountBuilderFinish(account),
      timeoutPromise
    ])

    if (!data) {
      toast.error('Failed to create sample wallet')
      return
    }
    if (connectionMode === 'auto') {
      const updatedAccount = [
        'segwit',
        'legacy',
        'watchonlyXpub',
        'multisig'
      ].includes(type)
        ? await syncAccountWithWallet(
            data.accountWithEncryptedSecret,
            data.wallet!
          )
        : await syncAccountWithAddress(data.accountWithEncryptedSecret)
      updateAccount(updatedAccount)
    }
    toast.success('Sample wallet created successfully!')
  }

  const renderTab = () => {
    return (
      <SSHStack
        gap="none"
        justifyEvenly
        style={{
          paddingVertical: 0,
          borderBottomWidth: 1,
          borderBottomColor: Colors.gray[800]
        }}
      >
        {tabs.map((tab, index) => (
          <SSActionButton
            key={tab.key}
            style={{ width: '30%', height: 48 }}
            onPress={() => setTabIndex(index)}
          >
            <SSVStack gap="none">
              <SSText
                center
                uppercase
                style={{ lineHeight: 20, letterSpacing: 3 }}
              >
                {tab.key}
              </SSText>
              {tabIndex === index && (
                <View
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: 1,
                    bottom: -15,
                    alignSelf: 'center',
                    backgroundColor: Colors.white
                  }}
                />
              )}
            </SSVStack>
          </SSActionButton>
        ))}
      </SSHStack>
    )
  }

  const renderSamplewallets = () => {
    switch (network) {
      case 'bitcoin':
        return (
          <SSVStack
            itemsCenter
            style={{
              marginTop: 48,
              paddingVertical: 32
            }}
          >
            <SSText color="muted" uppercase>
              {t('accounts.samples')}
            </SSText>
            <SSButton
              label={t('account.load.sample.bitcoin.address.salvador')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlySalvador')}
              loading={loadingWallet === 'watchonlySalvador'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.segwit')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlySegwit')}
              loading={loadingWallet === 'watchonlySegwit'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.tether')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyTether')}
              loading={loadingWallet === 'watchonlyTether'}
            />
          </SSVStack>
        )
      case 'testnet':
        return (
          <SSVStack
            itemsCenter
            style={{
              marginTop: 48,
              paddingVertical: 32
            }}
          >
            <SSText color="muted" uppercase>
              {t('accounts.samples')}
            </SSText>
            <SSButton
              label={t('account.load.sample.testnet.address')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyTestnet4')}
              loading={loadingWallet === 'watchonlyTestnet4'}
            />
          </SSVStack>
        )
      case 'signet':
        return (
          <SSVStack
            itemsCenter
            style={{
              marginTop: 48,
              paddingVertical: 32
            }}
          >
            <SSText color="muted" uppercase>
              {t('accounts.samples')}
            </SSText>
            <SSButton
              label={t('account.load.sample.signet.segwit')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('segwit')}
              loading={loadingWallet === 'segwit'}
            />
            <SSButton
              label={t('account.load.sample.signet.multisig')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('multisig')}
              loading={loadingWallet === 'multisig'}
            />
            <SSButton
              label={t('account.load.sample.signet.legacy')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('legacy')}
              loading={loadingWallet === 'legacy'}
            />
            <SSButton
              label={t('account.load.sample.signet.xpub')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyXpub')}
              loading={loadingWallet === 'watchonlyXpub'}
            />
            <SSButton
              label={t('account.load.sample.signet.address')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyAddress')}
              loading={loadingWallet === 'watchonlyAddress'}
            />
          </SSVStack>
        )
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('app.name')}
            </SSText>
          )
        }}
      />
      <TouchableOpacity
        onPress={() => router.navigate('/settings/network/server')}
      >
        <SSHStack
          style={{ justifyContent: 'center', gap: 0, marginBottom: 24 }}
        >
          {connectionState ? (
            isPrivateConnection ? (
              <SSIconYellowIndicator height={24} width={24} />
            ) : (
              <SSIconGreenIndicator height={24} width={24} />
            )
          ) : (
            <SSIconBlackIndicator height={24} width={24} />
          )}
          <SSText
            size="xxs"
            uppercase
            style={{
              color: connectionState ? Colors.gray['200'] : Colors.gray['450']
            }}
          >
            {connectionString}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
      <SSHStack style={{ paddingHorizontal: '5%' }}>
        <View style={{ flex: 1 }}>
          <SSButton
            label={t('account.add')}
            style={{
              borderTopWidth: 1,
              borderTopColor: '#303030',
              borderBottomWidth: 1,
              borderBottomColor: '#222222',
              borderRadius: 0
            }}
            onPress={handleOnNavigateToAddAccount}
            variant="gradient"
            gradientType="special"
          />
        </View>
      </SSHStack>
      <SSMainLayout style={{ paddingTop: 32, paddingHorizontal: '5%' }}>
        <TabView
          swipeEnabled={false}
          navigationState={{ index: tabIndex, routes: tabs }}
          renderScene={() => (
            <ScrollView
              style={{ marginTop: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <FlashList
                data={filteredAccounts}
                renderItem={({ item }) => (
                  <SSVStack>
                    <SSAccountCard
                      account={item}
                      onPress={() => handleGoToAccount(item.id)}
                    />
                  </SSVStack>
                )}
                estimatedItemSize={20}
                ItemSeparatorComponent={() => (
                  <SSSeparator
                    style={{ marginVertical: 16 }}
                    color="gradient"
                  />
                )}
                ListEmptyComponent={
                  <SSVStack
                    itemsCenter
                    style={{ paddingTop: 32, paddingBottom: 32 }}
                  >
                    <SSText uppercase>{t('accounts.empty')}</SSText>
                  </SSVStack>
                }
                showsVerticalScrollIndicator={false}
              />
              {renderSamplewallets()}
            </ScrollView>
          )}
          onIndexChange={setTabIndex}
          initialLayout={{ width }}
          renderTabBar={renderTab}
        />
      </SSMainLayout>
    </>
  )
}
