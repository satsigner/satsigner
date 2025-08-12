import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { View } from 'react-native'

import {
  SSIconChartSettings,
  SSIconCollapse,
  SSIconExpand,
  SSIconHistoryChart,
  SSIconMenu,
  SSIconRefresh
} from '@/components/icons'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import { t } from '@/locales'
import { type Direction } from '@/types/logic/sort'
import type { AccountTransaction, AccountUtxo } from '@/types/models/Account'
import { sortTransactions } from '@/utils/sort'

import SSIconButton from './SSIconButton'
import SSSortDirectionToggle from './SSSortDirectionToggle'
import SSText from './SSText'
import SSTransactionList from './SSTransactionList'

type SSTotalTransactionsProps = {
  transactions: AccountTransaction[]
  utxos: AccountUtxo[]
  onRefresh: () => Promise<void>
  onExpand: (state: boolean) => Promise<void>
  expand: boolean
  refreshing: boolean
  blockchainHeight: number
}

function SSTotalTransactions({
  transactions,
  utxos,
  onRefresh,
  onExpand,
  expand,
  refreshing,
  blockchainHeight
}: SSTotalTransactionsProps) {
  const router = useRouter()

  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const sortedTransactions = useMemo(() => {
    return sortTransactions(
      [...transactions],
      sortDirection
    ) as AccountTransaction[]
  }, [transactions, sortDirection])

  const chartTransactions = useMemo(() => {
    return sortTransactions([...transactions], 'desc')
  }, [transactions])

  const [showHistoryChart, setShowHistoryChart] = useState<boolean>(false)

  return (
    <SSMainLayout style={{ paddingTop: 0, paddingHorizontal: 0 }}>
      <SSHStack
        justifyBetween
        style={{ paddingVertical: 16, paddingHorizontal: 16 }}
      >
        <SSHStack>
          <SSIconButton onPress={() => onRefresh()}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={() => onExpand(!expand)}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={16} />
            )}
          </SSIconButton>
          {showHistoryChart && (
            <SSIconButton
              onPress={() => router.navigate(`/settings/features/historyChart`)}
            >
              <SSIconChartSettings width={22} height={18} />
            </SSIconButton>
          )}
        </SSHStack>
        <SSText color="muted">{t('account.parentAccountActivity')}</SSText>
        <SSHStack>
          <SSIconButton onPress={() => setShowHistoryChart((prev) => !prev)}>
            {showHistoryChart ? (
              <SSIconMenu width={18} height={18} />
            ) : (
              <SSIconHistoryChart width={18} height={18} />
            )}
          </SSIconButton>
          <SSSortDirectionToggle
            onDirectionChanged={(direction) => setSortDirection(direction)}
          />
        </SSHStack>
      </SSHStack>
      {showHistoryChart && sortedTransactions.length > 0 ? (
        <View style={{ flex: 1, zIndex: -1 }}>
          <SSHistoryChart transactions={chartTransactions} utxos={utxos} />
        </View>
      ) : (
        <SSTransactionList
          transactions={sortedTransactions}
          expand={expand}
          onRefresh={onRefresh}
          refreshing={refreshing}
          blockchainHeight={blockchainHeight}
        />
      )}
    </SSMainLayout>
  )
}

export default SSTotalTransactions
