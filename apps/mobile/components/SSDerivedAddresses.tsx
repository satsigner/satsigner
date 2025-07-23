import { FlashList } from '@shopify/flash-list'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'

import { getLastUnusedAddressFromWallet, getWalletAddresses } from '@/api/bdk'
import { SSIconCollapse, SSIconExpand, SSIconRefresh } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Direction } from '@/types/logic/sort'
import { type Account } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { formatAddress } from '@/utils/format'
import { parseAccountAddressesDetails } from '@/utils/parse'

type DerivedAddressesProps = {
  account: Account
  setSortDirection: Function
  sortDirection: Direction
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  setChange: Function
  change: boolean
  perPage?: number
}

const SCREEN_WIDTH = Dimensions.get('window').width
const ADDRESS_LIST_WIDTH = SCREEN_WIDTH * 1.1

function DerivedAddresses({
  account,
  handleOnExpand,
  setChange,
  change,
  expand,
  setSortDirection,
  perPage = 10
}: DerivedAddressesProps) {
  const wallet = useGetAccountWallet(account.id!)
  const network = useBlockchainStore(
    (state) => state.selectedNetwork
  ) as Network
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  const [addressPath, setAddressPath] = useState('')
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressCount, setAddressCount] = useState(
    Math.max(1, Math.ceil(account.addresses.length / perPage)) * perPage
  )
  const [addresses, setAddresses] = useState([...account.addresses])
  const [_hasLoadMoreAddresses, setHasLoadMoreAddresses] = useState(false)
  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function updateDerivationPath() {
    if (isMultiAddressWatchOnly) return
    if (account.keys[0].derivationPath)
      setAddressPath(`${account.keys[0].derivationPath}/${change ? 1 : 0}`)
  }

  function loadExactAccountAddresses() {
    setAddresses([...account.addresses])
    setAddressCount(account.addresses.length)
  }

  async function refreshAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    let addresses = await getWalletAddresses(wallet!, network!, addressCount)
    addresses = parseAccountAddressesDetails({ ...account, addresses })
    setAddresses(addresses.slice(0, addressCount))
    updateAccount({ ...account, addresses })
  }

  async function loadMoreAddresses() {
    if (isMultiAddressWatchOnly) {
      loadExactAccountAddresses()
      return
    }

    setHasLoadMoreAddresses(true)
    const newAddressCount =
      addresses.length < addressCount ? addressCount : addressCount + perPage
    setAddressCount(newAddressCount)
    setLoadingAddresses(true)

    let addrList = await getWalletAddresses(wallet!, network!, newAddressCount)
    addrList = parseAccountAddressesDetails({
      ...account,
      addresses: addrList
    })
    setAddresses(addrList)
    setLoadingAddresses(false)
    updateAccount({ ...account, addresses: addrList })
  }

  async function updateAddresses() {
    if (!wallet) return

    const result = await getLastUnusedAddressFromWallet(wallet!)

    if (!result) return
    const minItems = Math.max(1, Math.ceil(result.index / perPage)) * perPage

    if (minItems <= addressCount) return

    if (account.addresses.length >= addressCount) {
      let newAddresses = await getWalletAddresses(
        wallet!,
        network!,
        addressCount
      )
      newAddresses = parseAccountAddressesDetails({
        ...account,
        addresses: newAddresses
      })
      setAddresses(newAddresses)
      return
    }

    let newAddresses = await getWalletAddresses(wallet!, network!, minItems)
    newAddresses = parseAccountAddressesDetails({
      ...account,
      addresses: newAddresses
    })
    setAddressCount(minItems)
    setAddresses(newAddresses)
    updateAccount({ ...account, addresses: newAddresses })
  }

  useEffect(() => {
    updateDerivationPath()
  }, [change]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateAddresses()
  }, [account]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(
    ({ item }: { item: Address }) => (
      <TouchableOpacity
        onPress={() =>
          router.navigate(`/account/${account.id}/address/${item.address}`)
        }
      >
        <SSHStack style={addressListStyles.row}>
          {!isMultiAddressWatchOnly && (
            <SSText
              style={[
                addressListStyles.indexText,
                addressListStyles.columnIndex
              ]}
            >
              {item.index}
            </SSText>
          )}
          <SSText
            style={[
              addressListStyles.addressText,
              addressListStyles.columnAddress
            ]}
          >
            {formatAddress(item.address, 4)}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnLabel,
              { color: item.label ? '#fff' : '#333' }
            ]}
          >
            {item.label || t('transaction.noLabel')}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnTxs,
              { color: item.summary.transactions === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.transactions}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnSats,
              { color: item.summary.balance === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.balance}
          </SSText>
          <SSText
            style={[
              addressListStyles.columnUtxos,
              { color: item.summary.utxos === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.utxos}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
    ),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <SSMainLayout style={addressListStyles.container}>
      <SSHStack justifyBetween style={addressListStyles.header}>
        <SSHStack>
          <SSIconButton onPress={refreshAddresses}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={() => handleOnExpand(!expand)}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={16} />
            )}
          </SSIconButton>
        </SSHStack>
        {!isMultiAddressWatchOnly && (
          <SSHStack gap="sm">
            <SSText color="muted" uppercase>
              {t('receive.path')}
            </SSText>
            <SSText>{addressPath}</SSText>
          </SSHStack>
        )}
        <SSHStack gap="sm" style={{ width: 40, justifyContent: 'flex-end' }}>
          <SSSortDirectionToggle
            onDirectionChanged={() => setSortDirection()}
          />
        </SSHStack>
      </SSHStack>
      {!isMultiAddressWatchOnly && (
        <SSHStack
          gap="md"
          justifyBetween
          style={addressListStyles.receiveChangeContainer}
        >
          {[t('accounts.receive'), t('accounts.change')].map((type, index) => (
            <SSHStack key={type} style={{ flex: 1, justifyContent: 'center' }}>
              <SSButton
                style={{
                  borderColor: change === (index === 1) ? '#fff' : '#333'
                }}
                uppercase
                onPress={() => setChange(index === 1)}
                label={type}
                variant="outline"
              />
            </SSHStack>
          ))}
        </SSHStack>
      )}
      <ScrollView style={{ marginTop: 10 }} horizontal>
        <SSVStack gap="none" style={{ width: ADDRESS_LIST_WIDTH }}>
          <SSHStack style={addressListStyles.headerRow}>
            {!isMultiAddressWatchOnly && (
              <SSText
                style={[
                  addressListStyles.headerText,
                  addressListStyles.columnIndex
                ]}
              >
                {t('address.list.table.index')}
              </SSText>
            )}
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnAddress
              ]}
            >
              {t('bitcoin.address')}
            </SSText>
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnLabel
              ]}
            >
              {t('common.label')}
            </SSText>
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnTxs
              ]}
            >
              {t('address.list.table.tx')}
            </SSText>
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnSats
              ]}
            >
              {t('address.list.table.balance')}
            </SSText>
            <SSText
              style={[
                addressListStyles.headerText,
                addressListStyles.columnUtxos
              ]}
            >
              {t('address.list.table.utxo')}
            </SSText>
          </SSHStack>
          <FlashList
            data={addresses?.filter(
              (address) =>
                isMultiAddressWatchOnly ||
                (change
                  ? address.keychain === 'internal'
                  : address.keychain === 'external')
            )}
            renderItem={renderItem}
            estimatedItemSize={150}
            keyExtractor={(item) => {
              return `${item.index || ''}:${item.address}:${item.keychain || ''}`
            }}
            removeClippedSubviews
          />
        </SSVStack>
      </ScrollView>
      {!isMultiAddressWatchOnly && (
        <SSButton
          variant="outline"
          uppercase
          style={{ marginTop: 10 }}
          label={t('address.list.table.loadMore')}
          disabled={loadingAddresses}
          onPress={loadMoreAddresses}
        />
      )}
    </SSMainLayout>
  )
}

const addressListStyles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 10
  },
  header: {
    paddingVertical: 4
  },
  headerText: {
    color: '#777',
    textTransform: 'uppercase'
  },
  columnAddress: { width: '20%' },
  columnLabel: { width: '15%' },
  columnSats: { width: '10%', textAlign: 'center' },
  columnTxs: { width: '10%', textAlign: 'center' },
  columnUtxos: { width: '10%', textAlign: 'center' },
  columnIndex: { width: '10%', textAlign: 'center' },
  row: {
    paddingVertical: 12,
    width: ADDRESS_LIST_WIDTH,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#333',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  indexText: {
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center'
  },
  addressText: {
    color: '#fff',
    flexWrap: 'nowrap'
  },
  headerRow: {
    paddingBottom: 10,
    paddingTop: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: ADDRESS_LIST_WIDTH
  },
  receiveChangeContainer: {
    display: 'flex',
    width: '100%',
    marginTop: 10
  }
})

export default DerivedAddresses
