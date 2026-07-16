import { useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native'

import {
  SSIconCollapse,
  SSIconExpand,
  SSIconList,
  SSIconRefresh,
  SSIconTable
} from '@/components/icons'
import SSArkAddressCard from '@/components/SSArkAddressCard'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Label } from '@/types/bips/329'
import { type Direction } from '@/types/logic/sort'
import type { ArkAddress } from '@/types/models/Ark'
import { formatAddress } from '@/utils/format'
import { parseLabel } from '@/utils/parse'

const TABLE_WIDTH_RATIO = 1.2
const TABLE_BODY_HEIGHT_RATIO = 0.32
const TABLE_BODY_HEIGHT_RATIO_EXPANDED = 0.62
const ADDRESS_TRUNCATE_CHARS = 6
const LABEL_TRUNCATE_CHARS = 14

type SSArkAddressesViewProps = {
  addresses: ArkAddress[]
  labels: Record<string, Label>
  expand: boolean
  onToggleExpand: () => void
  onRefresh: () => void
  onPressAddress: (address: string) => void
  emptyComponent: React.ReactNode
}

function trimLabel(rawLabel: string | undefined): string {
  const { label, tags } = parseLabel(rawLabel ?? '')
  const text = label || tags.join(' ')
  if (!text) {
    return t('transaction.noLabel')
  }
  return text.length > LABEL_TRUNCATE_CHARS
    ? `${text.substring(0, LABEL_TRUNCATE_CHARS)}...`
    : text
}

function SSArkAddressesView({
  addresses,
  labels,
  expand,
  onToggleExpand,
  onRefresh,
  onPressAddress,
  emptyComponent
}: SSArkAddressesViewProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [view, setView] = useState<'table' | 'list'>('table')
  const [sortDirection, setSortDirection] = useState<Direction>('desc')

  const tableWidth = screenWidth * TABLE_WIDTH_RATIO
  const tableBodyMaxHeight =
    screenHeight *
    (expand ? TABLE_BODY_HEIGHT_RATIO_EXPANDED : TABLE_BODY_HEIGHT_RATIO)

  const sortedAddresses = addresses.toSorted((a, b) =>
    sortDirection === 'asc' ? a.index - b.index : b.index - a.index
  )

  function renderTableRow(address: ArkAddress) {
    const label = labels[address.address]?.label
    return (
      <TouchableOpacity
        key={address.address}
        onPress={() => onPressAddress(address.address)}
      >
        <SSHStack style={styles.row}>
          <SSText style={[styles.indexText, styles.columnIndex]}>
            {address.index}
          </SSText>
          <SSText
            type="mono"
            style={[styles.addressText, styles.columnAddress]}
          >
            {formatAddress(address.address, ADDRESS_TRUNCATE_CHARS)}
          </SSText>
          <SSText
            style={[
              styles.columnLabel,
              { color: label ? Colors.white : Colors.gray[700] }
            ]}
          >
            {trimLabel(label)}
          </SSText>
          <SSText
            style={[
              styles.columnSats,
              {
                color:
                  address.receivedSats === 0 ? Colors.gray[700] : Colors.white
              }
            ]}
          >
            <SSStyledSatText amount={address.receivedSats} textSize="xs" />
          </SSText>
          <SSText
            style={[
              styles.columnTxs,
              {
                color:
                  address.receiveCount === 0 ? Colors.gray[700] : Colors.white
              }
            ]}
          >
            {address.receiveCount}
          </SSText>
        </SSHStack>
      </TouchableOpacity>
    )
  }

  function renderTable() {
    return (
      <ScrollView style={styles.tableScroll} horizontal>
        <SSVStack
          gap="none"
          style={[styles.tableContainer, { width: tableWidth }]}
        >
          <SSHStack style={[styles.headerRow, { width: tableWidth }]}>
            <SSText style={[styles.headerText, styles.columnIndex]}>#</SSText>
            <SSText style={[styles.headerText, styles.columnAddress]}>
              {t('bitcoin.address')}
            </SSText>
            <SSText style={[styles.headerText, styles.columnLabel]}>
              {t('common.label')}
            </SSText>
            <SSText style={[styles.headerText, styles.columnSats]}>
              {t('address.list.table.balance')}
            </SSText>
            <SSText style={[styles.headerText, styles.columnTxs]}>
              {t('address.list.table.tx')}
            </SSText>
          </SSHStack>
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: tableBodyMaxHeight }}
            contentContainerStyle={styles.tableBodyContent}
          >
            <SSVStack gap="none">
              {sortedAddresses.map(renderTableRow)}
              {sortedAddresses.length === 0 && emptyComponent}
            </SSVStack>
          </ScrollView>
        </SSVStack>
      </ScrollView>
    )
  }

  function renderList() {
    return (
      <ScrollView>
        <SSVStack style={styles.listContent}>
          {sortedAddresses.map((address, index) => (
            <SSVStack key={address.address} gap="xs">
              {index > 0 && <SSSeparator color="gradient" />}
              <TouchableOpacity onPress={() => onPressAddress(address.address)}>
                <SSArkAddressCard
                  address={address}
                  label={labels[address.address]?.label ?? ''}
                />
              </TouchableOpacity>
            </SSVStack>
          ))}
          {sortedAddresses.length === 0 && emptyComponent}
        </SSVStack>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <SSHStack justifyBetween style={styles.controls}>
        <SSHStack>
          <SSIconButton onPress={onRefresh}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={onToggleExpand}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={15} />
            )}
          </SSIconButton>
          <SSIconButton
            onPress={() => setView(view === 'table' ? 'list' : 'table')}
          >
            {view === 'table' ? (
              <SSIconList height={15} width={15} />
            ) : (
              <SSIconTable height={15} width={15} />
            )}
          </SSIconButton>
        </SSHStack>
        <SSHStack gap="sm" style={styles.sortToggle}>
          <SSSortDirectionToggle
            onDirectionChanged={(direction) => setSortDirection(direction)}
          />
        </SSHStack>
      </SSHStack>
      {view === 'table' ? renderTable() : renderList()}
    </View>
  )
}

const styles = StyleSheet.create({
  addressText: {
    color: Colors.white,
    flexWrap: 'nowrap'
  },
  columnAddress: {
    width: '25%'
  },
  columnIndex: {
    textAlign: 'center',
    width: '5%'
  },
  columnLabel: {
    width: '15%'
  },
  columnSats: {
    flexWrap: 'nowrap',
    textAlign: 'center',
    width: '18%'
  },
  columnTxs: {
    textAlign: 'center',
    width: '10%'
  },
  container: {
    paddingBottom: 10,
    paddingHorizontal: '6%',
    paddingTop: 10
  },
  controls: {
    paddingVertical: 4
  },
  headerRow: {
    alignItems: 'center',
    backgroundColor: Colors.gray[900],
    borderBottomWidth: 1,
    borderColor: Colors.gray[700],
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 4,
    paddingTop: 10
  },
  headerText: {
    color: Colors.gray[300],
    textTransform: 'uppercase'
  },
  indexText: {
    color: Colors.white,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  listContent: {
    paddingVertical: 10
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: Colors.gray[700],
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 12
  },
  sortToggle: {
    justifyContent: 'flex-end',
    width: 40
  },
  tableBodyContent: {
    paddingBottom: 24
  },
  tableContainer: {
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden'
  },
  tableScroll: {
    marginTop: 10
  }
})

export default SSArkAddressesView
