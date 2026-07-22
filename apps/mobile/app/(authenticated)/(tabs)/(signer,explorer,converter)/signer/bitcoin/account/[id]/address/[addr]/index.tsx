import { toOutputScript } from 'bitcoinjs-lib/src/address'
import { toASM } from 'bitcoinjs-lib/src/script'
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSDetailsList from '@/components/SSDetailsList'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSModal from '@/components/SSModal'
import SSPinAuth from '@/components/SSPinAuth'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Account, type Secret } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type Utxo } from '@/types/models/Utxo'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { decryptKeySecret, getAccountFingerprint } from '@/utils/account'
import {
  getAddressKeyPairFromExtendedKey,
  getAddressKeyPairFromSeed,
  getExtendedPrivateKeyFromDescriptor
} from '@/utils/bip32'
import { mnemonicToSeed } from '@/utils/bip39'
import { appNetworkToBdkNetwork, bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

type AddressKeyPair = {
  privateKey: string
  publicKey: string
}

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()
  const [script, setScript] = useState('')

  const [account, address] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === accountId),
      state.accounts
        .find((account) => account.id === accountId)
        ?.addresses.find((address) => address.address === addr)
    ])
  )

  const transactions = account?.transactions.filter((tx) =>
    address?.transactions.includes(tx.id)
  )

  const addressUtxos = account?.utxos.filter((utxo) =>
    address?.utxos.includes(getUtxoOutpoint(utxo))
  )

  const allAccountUtxos = account?.utxos || []

  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const addressUtxoInputs = useMemo(() => addressUtxos || [], [addressUtxos])

  const blockchainHeight = useBlockchainStore(
    (state) => state.lastKnownBlockHeight
  )

  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const { width, height } = useWindowDimensions()

  const mainLayoutHorizontalPadding = 12
  const GRAPH_HEIGHT = height * 0.44
  const GRAPH_WIDTH = width * ((100 - mainLayoutHorizontalPadding) / 100)

  const [showKeyPinEntry, setShowKeyPinEntry] = useState(false)
  const [addressKeyPair, setAddressKeyPair] = useState<AddressKeyPair | null>(
    null
  )
  const [keyUnavailable, setKeyUnavailable] = useState(false)

  const key = account?.keys[0]

  async function handleRevealKeys() {
    if (!account || !address || !key) {
      return
    }
    try {
      const secret = await decryptKeySecret(key)
      const pair = getAddressKeyPair(secret, address, account.network)
      setAddressKeyPair(pair)
      setKeyUnavailable(!pair)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown reason'
      toast.error(`${t('address.details.key.unableToDecrypt')}: ${reason}`)
    } finally {
      setShowKeyPinEntry(false)
    }
  }

  function handleShowKeyPress() {
    setShowKeyPinEntry(true)
  }

  function handleKeyPinTriesOver() {
    setShowKeyPinEntry(false)
  }

  useEffect(() => {
    if (!address) {
      return
    }
    try {
      const rawScript = toOutputScript(
        address.address,
        bitcoinjsNetwork(address.network || 'signet')
      )
      setScript(toASM(rawScript))
    } catch {
      setScript('')
    }
  }, [address])

  if (!account || !addr) {
    return <Redirect href="/" />
  }

  if (!address) {
    router.back()
    return null
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('address.details.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
          <SSVStack>
            <SSVStack>
              <SSText weight="bold" uppercase size="md">
                {t('bitcoin.address')}
              </SSText>
              <SSAddressDisplay address={addr} />
            </SSVStack>
            <SSSeparator />
            <SSLabelDetails
              label={address.label}
              header={t('common.label').toUpperCase()}
              link={`/signer/bitcoin/account/${accountId}/address/${addr}/label`}
              privacyMode={privacyMode}
            />
            <SSSeparator />
            <SSVStack gap="sm">
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.balance.confirmed'),
                    formatNumber(address.summary.balance)
                  ],
                  [
                    t('bitcoin.confirmations.unconfirmed'),
                    formatNumber(address.summary.satsInMempool)
                  ],
                  [
                    t('address.details.history.tx'),
                    address?.summary.transactions
                  ],
                  [t('address.details.history.utxo'), address?.summary.utxos]
                ]}
              />
            </SSVStack>
            <SSSeparator />
            {transactions && transactions.length > 0 && (
              <>
                <SSVStack>
                  <SSText uppercase size="md" weight="bold">
                    {t('bitcoin.transactions')}
                  </SSText>
                  <SSVStack gap="none">
                    {transactions.map((tx, index) => (
                      <SSTransactionCard
                        style={{
                          borderColor: Colors.gray[700],
                          borderTopWidth: index > 0 ? 1 : 0,
                          paddingBottom: 8,
                          paddingHorizontal: 0
                        }}
                        transaction={tx}
                        key={tx.id}
                        blockHeight={blockchainHeight}
                        fiatCurrency={fiatCurrency}
                        btcPrice={btcPrice}
                        link={`/signer/bitcoin/account/${accountId}/transaction/${tx.id}`}
                        expand
                      />
                    ))}
                  </SSVStack>
                </SSVStack>
                <SSSeparator />
              </>
            )}
            {addressUtxos &&
              addressUtxos.length > 0 &&
              allAccountUtxos.length > 0 && (
                <>
                  <SSVStack>
                    <SSText uppercase weight="bold" size="md">
                      {t('bitcoin.utxos')}
                    </SSText>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <SSBubbleChart
                        utxos={allAccountUtxos}
                        canvasSize={{
                          height: GRAPH_HEIGHT,
                          width: GRAPH_WIDTH
                        }}
                        inputs={addressUtxoInputs}
                        dimUnselected
                        onPress={({ txid, vout }: Utxo) =>
                          router.navigate(
                            `/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${vout}`
                          )
                        }
                      />
                    </GestureHandlerRootView>
                  </SSVStack>
                  <SSSeparator />
                </>
              )}
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.encoding.title')}
              </SSText>
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.encoding.scriptVersion'),
                    address.scriptVersion
                  ],
                  [t('address.details.encoding.network'), address.network]
                ]}
              />
              <SSVStack gap="xs">
                <SSText uppercase weight="bold">
                  {t('address.details.encoding.script')}
                </SSText>
                <SSText type="mono" uppercase color="muted">
                  {script}
                </SSText>
              </SSVStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                {t('address.details.derivation.title')}
              </SSText>
              <SSDetailsList
                columns={2}
                items={[
                  [
                    t('address.details.derivation.path'),
                    address.derivationPath,
                    { variant: 'mono' }
                  ],
                  [t('address.details.derivation.index'), address.index],
                  [
                    t('address.details.derivation.fingerprint'),
                    getAccountFingerprint(account),
                    { variant: 'mono' }
                  ],
                  [t('address.details.derivation.keychain'), address.keychain]
                ]}
              />
            </SSVStack>
            <SSSeparator />
            <SSVStack>
              <SSText uppercase weight="bold" size="md">
                {t('address.details.key.title')}
              </SSText>
              <SSDetailsList
                columns={1}
                items={[
                  [
                    t('address.details.key.public'),
                    addressKeyPair?.publicKey,
                    { copyToClipboard: true, variant: 'mono' }
                  ],
                  [
                    t('address.details.key.private'),
                    addressKeyPair?.privateKey,
                    { copyToClipboard: true, variant: 'mono' }
                  ]
                ]}
              />
              {!addressKeyPair && !keyUnavailable && (
                <SSButton
                  label={t('address.details.key.reveal')}
                  variant="outline"
                  onPress={handleShowKeyPress}
                />
              )}
              {keyUnavailable && (
                <SSText color="muted" size="xs">
                  {t('address.details.key.unavailable')}
                </SSText>
              )}
            </SSVStack>
          </SSVStack>
        </SSMainLayout>
      </ScrollView>
      <SSModal
        visible={showKeyPinEntry}
        onClose={() => setShowKeyPinEntry(false)}
      >
        <SSPinAuth
          title={t('account.enter.pin')}
          onSuccess={handleRevealKeys}
          onTriesOver={handleKeyPinTriesOver}
          maxTries={3}
        />
      </SSModal>
    </>
  )
}

function getAddressKeyPair(
  secret: Secret,
  address: Pick<Address, 'derivationPath' | 'index' | 'keychain'>,
  network: Account['network']
): AddressKeyPair | null {
  if (
    !address.derivationPath ||
    address.index === undefined ||
    !address.keychain
  ) {
    return null
  }

  try {
    if (secret.mnemonic) {
      const seed = mnemonicToSeed(secret.mnemonic, secret.passphrase)
      return getAddressKeyPairFromSeed(seed, address.derivationPath)
    }

    const descriptor = secret.externalDescriptor || secret.internalDescriptor
    const extendedPrivateKey = descriptor
      ? getExtendedPrivateKeyFromDescriptor(descriptor)
      : ''

    if (!extendedPrivateKey) {
      return null
    }

    const change = address.keychain === 'internal' ? 1 : 0
    return getAddressKeyPairFromExtendedKey(
      extendedPrivateKey,
      appNetworkToBdkNetwork(network),
      `${change}/${address.index}`
    )
  } catch {
    return null
  }
}

export default AddressDetails
