import { FlashList } from '@shopify/flash-list'
import { Stack, useFocusEffect, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getExtendedPublicKeyFromMnemonic } from '@/api/bdk'
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
import { getFingerprintFromMnemonic } from '@/utils/bip39'
import { generateSalt, pbkdf2Encrypt } from '@/utils/crypto'
import {
  sampleMultiAddressTether,
  sampleSalvadorAddress,
  sampleSegwitAddress,
  sampleSignetAddress,
  sampleSignetWalletSeed,
  sampleSignetXpub,
  sampleSignetXpubFingerprint,
  sampleTestnet4Address
} from '@/utils/samples'

// Helper function to map local Network type to bdk-rn Network enum
function mapNetworkToBdkNetwork(network: 'bitcoin' | 'testnet' | 'signet') {
  const { Network } = require('bdk-rn/lib/lib/enums')
  switch (network) {
    case 'bitcoin':
      return Network.Bitcoin
    case 'testnet':
      return Network.Testnet
    case 'signet':
      return Network.Signet
    default:
      return Network.Bitcoin
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
        state.configsMempool['bitcoin']
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
    if (connectionMode === 'auto') fetchPrices(mempoolUrl)
  }, [connectionMode, fetchPrices, mempoolUrl])

  useFocusEffect(() => {
    cleanupSubscriptions()
  })

  function handleOnNavigateToAddAccount() {
    clearAccount()
    router.navigate('/account/add')
  }

  function handleGoToAccount(accountId: string) {
    router.navigate(`/account/${accountId}`)
  }

  async function syncAccounts() {
    for (const account of accounts) {
      if (account.network !== tabs[tabIndex].key) continue

      const isImportAddress = account.keys[0].creationType === 'importAddress'

      if (isImportAddress && !addresses[account.id]) continue
      if (!isImportAddress && !wallets[account.id]) continue

      if (connectionMode === 'auto' && account.syncStatus !== 'syncing') {
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

  async function loadSampleWallet(type: SampleWallet) {
    setLoadingWallet(type)

    try {
      // Check if PIN is available, if not set a default one
      const pin = await getItem(PIN_KEY)
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

      let _sampleAddress

      switch (type) {
        case 'segwit': {
          // Validate the sample seed
          const seedWords = sampleSignetWalletSeed.split(' ')
          if (seedWords.length !== 12) {
            throw new Error('Invalid sample seed: must be 12 words')
          }

          // Generate fingerprint and extended public key from mnemonic
          try {
            const fingerprint = getFingerprintFromMnemonic(
              sampleSignetWalletSeed,
              '',
              bdkNetwork
            )
            const extendedPublicKey = await getExtendedPublicKeyFromMnemonic(
              sampleSignetWalletSeed,
              '',
              bdkNetwork,
              'P2WPKH'
            )

            // Set the fingerprint and extended public key
            setFingerprint(fingerprint)
            setExtendedPublicKey(extendedPublicKey)

            // Additional validation
            if (!fingerprint || fingerprint.length === 0) {
              throw new Error('Generated fingerprint is empty or invalid')
            }
            if (!extendedPublicKey || extendedPublicKey.length === 0) {
              throw new Error(
                'Generated extended public key is empty or invalid'
              )
            }
          } catch (error) {
            throw new Error(
              `Failed to process mnemonic: ${(error as Error).message}`
            )
          }

          setScriptVersion('P2WPKH')
          setPolicyType('singlesig')
          setCreationType('importMnemonic')
          setMnemonicWordCount(12)
          setMnemonic(sampleSignetWalletSeed)
          break
        }
        case 'legacy': {
          // Validate the sample seed
          const legacySeedWords = sampleSignetWalletSeed.split(' ')
          if (legacySeedWords.length !== 12) {
            throw new Error('Invalid sample seed: must be 12 words')
          }

          // Generate fingerprint and extended public key from mnemonic
          try {
            const fingerprint = getFingerprintFromMnemonic(
              sampleSignetWalletSeed,
              '',
              bdkNetwork
            )
            const extendedPublicKey = await getExtendedPublicKeyFromMnemonic(
              sampleSignetWalletSeed,
              '',
              bdkNetwork,
              'P2PKH'
            )

            // Set the fingerprint and extended public key
            setFingerprint(fingerprint)
            setExtendedPublicKey(extendedPublicKey)

            // Additional validation
            if (!fingerprint || fingerprint.length === 0) {
              throw new Error('Generated fingerprint is empty or invalid')
            }
            if (!extendedPublicKey || extendedPublicKey.length === 0) {
              throw new Error(
                'Generated extended public key is empty or invalid'
              )
            }
          } catch (error) {
            throw new Error(
              `Failed to process mnemonic: ${(error as Error).message}`
            )
          }

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
          _sampleAddress = sampleSignetAddress
          setPolicyType('watchonly')
          setCreationType('importAddress')
          setExternalDescriptor(`addr(${sampleSignetAddress})`)
          break
        case 'watchonlySalvador':
          _sampleAddress = sampleSalvadorAddress
          setPolicyType('watchonly')
          setCreationType('importAddress')
          setExternalDescriptor(`addr(${sampleSalvadorAddress})`)
          break
        case 'watchonlySegwit':
          _sampleAddress = sampleSegwitAddress
          setPolicyType('watchonly')
          setCreationType('importAddress')
          setExternalDescriptor(`addr(${sampleSegwitAddress})`)
          break
        case 'watchonlyTestnet4':
          _sampleAddress = sampleTestnet4Address
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
      }

      if (type !== 'watchonlyTether') setKey(0)

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
      try {
        if (connectionMode === 'auto') {
          const updatedAccount = ['segwit', 'legacy', 'watchonlyXpub'].includes(
            type
          )
            ? await syncAccountWithWallet(
                data.accountWithEncryptedSecret,
                data.wallet!
              )
            : await syncAccountWithAddress(data.accountWithEncryptedSecret)
          updateAccount(updatedAccount)
          toast.success('Sample wallet created successfully!')
        } else {
          toast.success('Sample wallet created successfully!')
        }
      } catch (error) {
        toast.error(`Sync failed: ${(error as Error).message}`)
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      clearAccount()
      setLoadingWallet(undefined)
    }
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
              onPress={() => loadSampleWallet('watchonlySalvador')}
              loading={loadingWallet === 'watchonlySalvador'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.segwit')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlySegwit')}
              loading={loadingWallet === 'watchonlySegwit'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.tether')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlyTether')}
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
              onPress={() => loadSampleWallet('watchonlyTestnet4')}
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
              onPress={() => loadSampleWallet('segwit')}
              loading={loadingWallet === 'segwit'}
            />
            <SSButton
              label={t('account.load.sample.signet.legacy')}
              variant="subtle"
              onPress={() => loadSampleWallet('legacy')}
              loading={loadingWallet === 'legacy'}
            />
            <SSButton
              label={t('account.load.sample.signet.xpub')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlyXpub')}
              loading={loadingWallet === 'watchonlyXpub'}
            />
            <SSButton
              label={t('account.load.sample.signet.address')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlyAddress')}
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
