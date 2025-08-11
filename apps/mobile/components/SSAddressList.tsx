import { FlashList } from '@shopify/flash-list'
import { router } from 'expo-router'
import { useCallback } from 'react'
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity
} from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { AccountAddress } from '@/types/models/Account'
import { formatAddress } from '@/utils/format'

export type SSAddressListProps = {
  addresses: AccountAddress[]
  change: boolean
  showDerivationPath?: boolean
}

const SCREEN_WIDTH = Dimensions.get('window').width
const ADDRESS_LIST_WIDTH = SCREEN_WIDTH * 1.1

function SSAddressList({
  addresses,
  change,
  showDerivationPath = true
}: SSAddressListProps) {
  //
  const renderItem = useCallback(
    ({ item }: { item: AccountAddress }) => (
      <TouchableOpacity
        onPress={() =>
          router.navigate(`/account/${item.accountId}/address/${item.address}`)
        }
      >
        <SSHStack style={styles.row}>
          {showDerivationPath && (
            <SSText style={[styles.indexText, styles.columnIndex]}>
              {item.index}
            </SSText>
          )}
          <SSText style={[styles.addressText, styles.columnAddress]}>
            {formatAddress(item.address, 4)}
          </SSText>
          <SSText
            style={[
              styles.columnLabel,
              { color: item.label ? '#fff' : '#333' }
            ]}
          >
            {item.label || t('transaction.noLabel')}
          </SSText>
          <SSText
            style={[
              styles.columnTxs,
              { color: item.summary.transactions === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.transactions}
          </SSText>
          <SSText
            style={[
              styles.columnSats,
              { color: item.summary.balance === 0 ? '#333' : '#fff' }
            ]}
          >
            {item.summary.balance}
          </SSText>
          <SSText
            style={[
              styles.columnUtxos,
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
    <ScrollView style={{ marginTop: 10 }} horizontal>
      <SSVStack gap="none" style={{ width: ADDRESS_LIST_WIDTH }}>
        <SSHStack style={styles.headerRow}>
          {showDerivationPath && (
            <SSText style={[styles.headerText, styles.columnIndex]}>
              {t('address.list.table.index')}
            </SSText>
          )}
          <SSText style={[styles.headerText, styles.columnAddress]}>
            {t('bitcoin.address')}
          </SSText>
          <SSText style={[styles.headerText, styles.columnLabel]}>
            {t('common.label')}
          </SSText>
          <SSText style={[styles.headerText, styles.columnTxs]}>
            {t('address.list.table.tx')}
          </SSText>
          <SSText style={[styles.headerText, styles.columnSats]}>
            {t('address.list.table.balance')}
          </SSText>
          <SSText style={[styles.headerText, styles.columnUtxos]}>
            {t('address.list.table.utxo')}
          </SSText>
        </SSHStack>
        <FlashList
          data={addresses?.filter(
            (address) =>
              !showDerivationPath ||
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
  )
}

const styles = StyleSheet.create({
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
  }
})

export default SSAddressList
