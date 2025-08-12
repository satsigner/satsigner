import { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'

import { SSIconCollapse, SSIconExpand, SSIconRefresh } from '@/components/icons'
import SSAddressList from '@/components/SSAddressList'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { type Direction } from '@/types/logic/sort'
import { type AccountAddress } from '@/types/models/Account'

type DerivedAddressesProps = {
  addresses: AccountAddress[]
  derivationPath?: string
  isMultiAddressWatchOnly?: boolean
  showLoadMoreButton?: boolean
  loading?: boolean
  onLoadMore: () => void
  onRefresh: () => void
  handleOnExpand: (state: boolean) => Promise<void>
  expand: boolean
}

function DerivedAddresses({
  addresses,
  derivationPath,
  isMultiAddressWatchOnly = false,
  showLoadMoreButton = true,
  loading = false,
  onLoadMore,
  onRefresh,
  handleOnExpand,
  expand
}: DerivedAddressesProps) {
  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const [change, setChange] = useState(false)
  const [addressPath, setAddressPath] = useState('')

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

  useEffect(() => {
    updateDerivationPath()
  }, [change]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SSMainLayout style={styles.container}>
      <SSHStack justifyBetween style={styles.header}>
        <SSHStack>
          <SSIconButton onPress={onRefresh}>
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
      {showLoadMoreButton && (
        <SSButton
          variant="outline"
          uppercase
          style={{ marginTop: 10 }}
          label={t('address.list.table.loadMore')}
          disabled={loading}
          onPress={onLoadMore}
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
