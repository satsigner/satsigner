import { Stack, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
  ScaleDecorator
} from 'react-native-draggable-flatlist'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAccountCard, {
  type SSAccountCardStat
} from '@/components/SSAccountCard'
import SSActionButton from '@/components/SSActionButton'
import SSBlockFeePriceRow from '@/components/SSBlockFeePriceRow'
import SSButton from '@/components/SSButton'
import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
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
import useAccountsFingerprints from '@/hooks/useAccountsFingerprints'
import { useFiatData } from '@/hooks/useFiatData'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { type Network } from '@/types/settings/blockchain'
import { getAccountTotalBalance } from '@/utils/account'
import {
  getExtendedPublicKeyFromMnemonic,
  getExtendedPublicKeyFromMnemonicCustom,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { getFiatPriceApiUrl } from '@/utils/fiatData'
import { ensurePin } from '@/utils/pin'
import { time } from '@/utils/time'

function accountShowsFingerprint(account: Account) {
  return account.keys[0]?.creationType !== 'importAddress'
}

function buildAccountCardStats(
  summary: Account['summary']
): SSAccountCardStat[] {
  return [
    {
      label: t('accounts.totalTransactions'),
      value: summary.numberOfTransactions
    },
    {
      label: t('accounts.derivedAddresses'),
      value: summary.numberOfAddresses
    },
    {
      label: t('accounts.spendableOutputs'),
      value: summary.numberOfUtxos
    },
    {
      label: t('accounts.satsInMempool'),
      value: summary.satsInMempool
    }
  ]
}

export default function AccountList() {
  const router = useRouter()

  const [network, setSelectedNetwork, connectionMode, autoConnectDelay] =
    useBlockchainStore(
      useShallow((state) => [
        state.selectedNetwork,
        state.setSelectedNetwork,
        state.configs[state.selectedNetwork].config.connectionMode,
        state.configs[state.selectedNetwork].config.timeDiffBeforeAutoSync
      ])
    )
  const [accounts, updateAccount, setAccounts] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.updateAccount,
      state.setAccounts
    ])
  )
  const { fiatPriceApiUrl, showCurrentFiat } = useFiatData()
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
  const [fetchPrices, btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [
      state.fetchPrices,
      state.btcPrice,
      state.fiatCurrency
    ])
  )
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const [wallets, addresses] = useWalletsStore(
    useShallow((state) => [state.wallets, state.addresses])
  )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { accountBuilderFinish } = useAccountBuilderFinish()

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
    return Math.max(index, 0)
  })

  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>(
    accounts.filter((acc) => acc.network === tabs[tabIndex].key)
  )

  useEffect(() => {
    setFilteredAccounts(
      accounts.filter((acc) => acc.network === tabs[tabIndex].key)
    )
  }, [accounts, tabIndex]) // eslint-disable-line react-hooks/exhaustive-deps
  const fingerprints = useAccountsFingerprints(filteredAccounts)

  const totalBalance = useMemo(
    () =>
      filteredAccounts.reduce(
        (value, account) => value + getAccountTotalBalance(account.summary),
        0
      ),
    [filteredAccounts]
  )

  const totalSatsInMempoll = useMemo(
    () =>
      filteredAccounts.reduce(
        (value, account) => value + account.summary.satsInMempool,
        0
      ),
    [filteredAccounts]
  )

  const ACCOUNT_CARD_HEIGHT = 160
  const SEPARATOR_VERTICAL = 32
  const listItemCount = Math.max(filteredAccounts.length, 1)
  const listContainerMinHeight =
    listItemCount * ACCOUNT_CARD_HEIGHT +
    (listItemCount - 1) * SEPARATOR_VERTICAL

  const [connectionStatus, , isPrivateConnection, connectionParts] =
    useVerifyConnection()
  const { blockHeight, nextBlockFee, blockHeightSource } = useNetworkInfo()

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
    if (!showCurrentFiat) {
      return
    }
    fetchPrices(getFiatPriceApiUrl())
  }, [fetchPrices, fiatPriceApiUrl, showCurrentFiat])

  function handleOnNavigateToAddAccount() {
    clearAccount()
    router.navigate('/signer/bitcoin/account/add')
  }

  function handleGoToAccount(accountId: string) {
    router.navigate(`/signer/bitcoin/account/${accountId}`)
  }

  async function syncAccounts() {
    if (connectionMode !== 'auto') {
      return
    }

    const now = time.now()

    const eligibleAccounts = accounts.filter((account) => {
      if (account.network !== tabs[tabIndex].key) {
        return false
      }
      if (account.syncStatus === 'syncing') {
        return false
      }
      if (
        account.lastSyncedAt &&
        now > time.minutesAfter(account.lastSyncedAt, autoConnectDelay)
      ) {
        return false
      }
      const isImportAddress = account.keys[0].creationType === 'importAddress'
      if (isImportAddress && !addresses[account.id]) {
        return false
      }
      if (!isImportAddress && !wallets[account.id]) {
        return false
      }
      return true
    })

    // Address-based syncs are pure HTTP and safe to run in parallel.
    // BDK wallet syncs use a native Rust module that is not thread-safe for
    // concurrent calls, so those must remain sequential.
    const addressAccounts = eligibleAccounts.filter(
      (a) =>
        a.policyType === 'watchonly' &&
        a.keys[0].creationType === 'importAddress'
    )
    const walletAccounts = eligibleAccounts.filter(
      (a) =>
        !(
          a.policyType === 'watchonly' &&
          a.keys[0].creationType === 'importAddress'
        )
    )

    await Promise.allSettled(
      addressAccounts.map((account) =>
        syncAccountWithAddress(account).then((u) => updateAccount(u))
      )
    )

    for (const account of walletAccounts) {
      const u = await syncAccountWithWallet(account, wallets[account.id]!)
      if (u) {
        updateAccount(u)
      }
    }
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
    // Sample wallets need encryption key material. In development only, this
    // seeds a random ephemeral key when none exists (never a hardcoded PIN).
    await ensurePin()

    setName(`Sample (${type})`)
    setKeyCount(1)
    setKeysRequired(1)

    const currentNetwork = tabs[tabIndex].key as Network

    const bdkNetwork = appNetworkToBdkNetwork(currentNetwork)

    setNetwork(currentNetwork)

    if (currentNetwork !== network) {
      setSelectedNetwork(currentNetwork)
    }

    switch (type) {
      case 'segwit': {
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
        for (const [index, address] of sampleMultiAddressTether.entries()) {
          setExternalDescriptor(`addr(${address})`)
          setKey(index)
        }
        break
      case 'multisig': {
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
        const extendedPublicKey1 = getExtendedPublicKeyFromMnemonicCustom(
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
        const extendedPublicKey2 = getExtendedPublicKeyFromMnemonicCustom(
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
      default:
        break
    }

    if (type !== 'watchonlyTether' && type !== 'multisig') {
      setKey(0)
    }

    const account = getAccountData()

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

    if (['segwit', 'legacy'].includes(type)) {
      const [key] = account.keys
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

    if (type === 'multisig') {
      if (account.keys.length !== 3) {
        throw new Error('Multisig account must have exactly 3 keys')
      }
      if (account.keyCount !== 3 || account.keysRequired !== 2) {
        throw new Error('Multisig configuration invalid')
      }
      for (let i = 0; i < 2; i += 1) {
        const key = account.keys[i]
        if (
          !key.secret ||
          typeof key.secret !== 'object' ||
          !key.secret.mnemonic
        ) {
          throw new Error(`Mnemonic not properly set in key ${i + 1}`)
        }
      }
      const [key3] = account.keys.slice(2)
      if (
        !key3.secret ||
        typeof key3.secret !== 'object' ||
        !key3.secret.extendedPublicKey
      ) {
        throw new Error('Extended public key not properly set in key 3')
      }
    }

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
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
      const isWalletType = [
        'segwit',
        'legacy',
        'watchonlyXpub',
        'multisig'
      ].includes(type)
      const updatedAccount = isWalletType
        ? await syncAccountWithWallet(
            data.accountWithEncryptedSecret,
            data.wallet!
          )
        : await syncAccountWithAddress(data.accountWithEncryptedSecret)
      if (updatedAccount) {
        updateAccount(updatedAccount)
      }
    }
    toast.success('Sample wallet created successfully!')
  }

  function handleReorderAccounts(reorderedAccounts: Account[]) {
    const otherNetworkAccounts = accounts.filter(
      (a) => a.network !== tabs[tabIndex].key
    )
    const newAccounts = [...otherNetworkAccounts, ...reorderedAccounts]
    setAccounts(newAccounts)
  }

  const renderTab = () => (
    <SSHStack
      gap="none"
      justifyEvenly
      style={{
        borderBottomColor: Colors.gray[800],
        borderBottomWidth: 1,
        paddingVertical: 0
      }}
    >
      {tabs.map((tab, index) => (
        <SSActionButton
          key={tab.key}
          style={{ height: 48, width: '30%' }}
          onPress={() => setTabIndex(index)}
        >
          <SSVStack gap="none">
            <SSText
              center
              uppercase
              style={{ letterSpacing: 3, lineHeight: 20 }}
            >
              {tab.key}
            </SSText>
            {tabIndex === index && (
              <View
                style={{
                  alignSelf: 'center',
                  backgroundColor: Colors.white,
                  bottom: -15,
                  height: 1,
                  position: 'absolute',
                  width: '100%'
                }}
              />
            )}
          </SSVStack>
        </SSActionButton>
      ))}
    </SSHStack>
  )

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
              disabled={loadingWallet && loadingWallet !== 'watchonlySalvador'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.segwit')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlySegwit')}
              loading={loadingWallet === 'watchonlySegwit'}
              disabled={loadingWallet && loadingWallet !== 'watchonlySegwit'}
            />
            <SSButton
              label={t('account.load.sample.bitcoin.address.tether')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyTether')}
              loading={loadingWallet === 'watchonlyTether'}
              disabled={loadingWallet && loadingWallet !== 'watchonlyTether'}
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
              disabled={loadingWallet && loadingWallet !== 'watchonlyTestnet4'}
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
              disabled={loadingWallet && loadingWallet !== 'segwit'}
            />
            <SSButton
              label={t('account.load.sample.signet.multisig')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('multisig')}
              loading={loadingWallet === 'multisig'}
              disabled={loadingWallet && loadingWallet !== 'multisig'}
            />
            <SSButton
              label={t('account.load.sample.signet.legacy')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('legacy')}
              loading={loadingWallet === 'legacy'}
              disabled={loadingWallet && loadingWallet !== 'legacy'}
            />
            <SSButton
              label={t('account.load.sample.signet.xpub')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyXpub')}
              loading={loadingWallet === 'watchonlyXpub'}
              disabled={loadingWallet && loadingWallet !== 'watchonlyXpub'}
            />
            <SSButton
              label={t('account.load.sample.signet.address')}
              variant="subtle"
              onPress={() => handleLoadSampleWallet('watchonlyAddress')}
              loading={loadingWallet === 'watchonlyAddress'}
              disabled={loadingWallet && loadingWallet !== 'watchonlyAddress'}
            />
          </SSVStack>
        )
      default:
        return null
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('bitcoin.network.bitcoin')}
            </SSText>
          )
        }}
      />
      <SSMainLayout style={{ paddingTop: 0 }}>
        <View style={{ flex: 1, overflow: 'visible' }}>
          <SSVStack
            gap="none"
            style={{ alignItems: 'center', marginBottom: 24 }}
          >
            <TouchableOpacity
              onPress={() => router.navigate('/settings/network/server')}
            >
              <SSHStack style={{ gap: 0, justifyContent: 'center' }}>
                <SSConnectionStatusIndicator
                  isPrivateConnection={isPrivateConnection}
                  status={connectionStatus}
                />
                <SSText
                  size="xxs"
                  uppercase
                  style={{
                    color:
                      connectionStatus === 'connected'
                        ? Colors.gray['200']
                        : Colors.gray['450']
                  }}
                >
                  {`${connectionParts.network} - ${connectionParts.name}`}
                </SSText>
                <SSText
                  size="xxs"
                  uppercase
                  style={{
                    color: Colors.gray['500'],
                    marginLeft: 4
                  }}
                >
                  {connectionParts.url}
                </SSText>
              </SSHStack>
            </TouchableOpacity>
            <SSBlockFeePriceRow
              blockHeight={blockHeight}
              btcPrice={btcPrice}
              fiatCurrency={fiatCurrency}
              nextBlockFee={nextBlockFee}
              blockHeightSource={blockHeightSource}
            />
            <SSHStack
              gap="xxs"
              style={{ alignItems: 'baseline', justifyContent: 'center' }}
            >
              <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
                <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
                  {t('accounts.totalBalance')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray['200'] }}>
                  {privacyMode
                    ? '••••'
                    : totalBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })}
                </SSText>
              </SSHStack>
              <View style={{ width: 12 }} />
              <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
                <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
                  {t('accounts.satsInMempool').replace('\n', ' ')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray['200'] }}>
                  {privacyMode
                    ? '••••'
                    : totalSatsInMempoll.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })}
                </SSText>
              </SSHStack>
            </SSHStack>
          </SSVStack>
          <SSButton
            label={t('account.add')}
            style={{ marginBottom: 24 }}
            onPress={handleOnNavigateToAddAccount}
            variant="elevated"
          />
          {renderTab()}
          <NestableScrollContainer
            contentContainerStyle={{ paddingTop: 16 }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{
                minHeight: listContainerMinHeight
              }}
            >
              <NestableDraggableFlatList
                data={filteredAccounts}
                dragItemOverflow
                containerStyle={{ overflow: 'visible' }}
                onDragEnd={({ data }: { data: Account[] }) => {
                  handleReorderAccounts(data)
                }}
                keyExtractor={(item: Account) => item.id}
                renderItem={({
                  item,
                  drag,
                  isActive
                }: RenderItemParams<Account>) => (
                  <ScaleDecorator activeScale={1.05}>
                    <SSVStack>
                      <SSAccountCard
                        name={item.name}
                        balance={getAccountTotalBalance(item.summary)}
                        fingerprint={fingerprints[item.id]}
                        showFingerprint={accountShowsFingerprint(item)}
                        watchOnly={item.policyType === 'watchonly'}
                        syncStatus={item.syncStatus}
                        lastSyncedAt={item.lastSyncedAt}
                        stats={buildAccountCardStats(item.summary)}
                        onPress={() => handleGoToAccount(item.id)}
                        onLongPress={drag}
                        longPressDisabled={isActive}
                      />
                    </SSVStack>
                  </ScaleDecorator>
                )}
                ItemSeparatorComponent={() => (
                  <SSSeparator
                    style={{ marginVertical: 16 }}
                    color="gradient"
                  />
                )}
                ListEmptyComponent={
                  <SSVStack
                    itemsCenter
                    style={{ paddingBottom: 32, paddingTop: 32 }}
                  >
                    <SSText uppercase>{t('accounts.empty')}</SSText>
                  </SSVStack>
                }
                showsVerticalScrollIndicator={false}
              />
              {renderSamplewallets()}
            </View>
          </NestableScrollContainer>
        </View>
      </SSMainLayout>
    </>
  )
}
