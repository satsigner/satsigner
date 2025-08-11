import { type Network } from 'bdk-rn/lib/lib/enums'
import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import { getLastUnusedAddressFromWallet, getWalletAddresses } from '@/api/bdk'
import { SSIconCollapse, SSIconExpand, SSIconRefresh } from '@/components/icons'
import SSAddressList from '@/components/SSAddressList'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Direction } from '@/types/logic/sort'
import { type AccountAddress } from '@/types/models/Account'
import { parseAccountAddressesDetails } from '@/utils/parse'

type DerivedAddressesProps = {
  addresses: AccountAddress[]
  derivationPath?: string
  isMultiAddressWatchOnly?: boolean
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
  perPage?: number
}

function DerivedAddresses({
  addresses: accountAddresses,
  derivationPath,
  isMultiAddressWatchOnly = false,
  handleOnExpand,
  expand,
  perPage = 10
}: DerivedAddressesProps) {
  const wallet = useGetAccountWallet(account.id!)
  const network = useBlockchainStore(
    (state) => state.selectedNetwork
  ) as Network
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const [change, setChange] = useState(false)
  const [addressPath, setAddressPath] = useState('')
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressCount, setAddressCount] = useState(
    Math.max(1, Math.ceil(accountAddresses.length / perPage)) * perPage
  )
  const [addresses, setAddresses] = useState([...accountAddresses])
  const [_hasLoadMoreAddresses, setHasLoadMoreAddresses] = useState(false)

  function sortAddresses(addresses: AccountAddress[]) {
    // we reverse the array instead of sorting is because we ASSUME the array is
    // originally sorted by index
    if (sortDirection === 'desc') return addresses.toReversed()
    return addresses
  }

  function updateDerivationPath() {
    if (isMultiAddressWatchOnly) return
    if (derivationPath) setAddressPath(`${derivationPath}/${change ? 1 : 0}`)
  }

  function loadExactAccountAddresses() {
    setAddresses([...accountAddresses])
    setAddressCount(accountAddresses.length)
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

  return (
    <SSMainLayout style={styles.container}>
      <SSHStack justifyBetween style={styles.header}>
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
          <SSSortDirectionToggle onDirectionChanged={setSortDirection} />
        </SSHStack>
      </SSHStack>
      {!isMultiAddressWatchOnly && (
        <SSHStack gap="md" justifyBetween style={styles.receiveChangeContainer}>
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
      <SSAddressList
        addresses={sortAddresses(addresses)}
        change={change}
        showDerivationPath={!isMultiAddressWatchOnly}
      />
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

const styles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 10
  },
  header: {
    paddingVertical: 4
  },
  receiveChangeContainer: {
    display: 'flex',
    width: '100%',
    marginTop: 10
  }
})

export default DerivedAddresses
