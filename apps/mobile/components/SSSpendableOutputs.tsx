import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native'

import {
  SSIconBubbles,
  SSIconCollapse,
  SSIconExpand,
  SSIconList,
  SSIconRefresh
} from '@/components/icons'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import SSUtxoCard from '@/components/SSUtxoCard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type AccountUtxo } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { compareTimestamp } from '@/utils/sort'
import { getUtxoOutpoint } from '@/utils/utxo'

type SpendableOutputsProps = {
  utxos: AccountUtxo[]
  onRefresh: () => Promise<void>
  onExpand: (state: boolean) => Promise<void>
  expand: boolean
  refreshing: boolean
}

function SpendableOutputs({
  utxos,
  onRefresh,
  onExpand,
  expand,
  refreshing
}: SpendableOutputsProps) {
  const router = useRouter()
  const { width, height } = useWindowDimensions()

  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const [view, setView] = useState('list')

  const halfHeight = height / 2
  const horizontalPadding = 48
  const GRAPH_HEIGHT = halfHeight
  const GRAPH_WIDTH = width - horizontalPadding

  function sortUtxos(utxos: Utxo[]) {
    return utxos.sort((utxo1, utxo2) =>
      sortDirection === 'asc'
        ? compareTimestamp(utxo1.timestamp, utxo2.timestamp)
        : compareTimestamp(utxo2.timestamp, utxo1.timestamp)
    )
  }

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <SSHStack justifyBetween style={{ paddingVertical: 16 }}>
        <SSHStack>
          <SSIconButton onPress={() => {}}>
            <SSIconRefresh height={18} width={22} />
          </SSIconButton>
          <SSIconButton onPress={() => onExpand(!expand)}>
            {expand ? (
              <SSIconCollapse height={15} width={15} />
            ) : (
              <SSIconExpand height={15} width={16} />
            )}
          </SSIconButton>
        </SSHStack>
        <SSText color="muted">{t('account.parentAccountActivity')}</SSText>
        <SSHStack>
          {view === 'list' && (
            <SSIconButton onPress={() => setView('bubbles')}>
              <SSIconBubbles height={16} width={16} />
            </SSIconButton>
          )}
          {view === 'bubbles' && (
            <SSIconButton onPress={() => setView('list')}>
              <SSIconList height={16} width={16} />
            </SSIconButton>
          )}
          <SSSortDirectionToggle
            onDirectionChanged={(direction) => setSortDirection(direction)}
          />
        </SSHStack>
      </SSHStack>
      {view === 'list' && (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.gray[950]]}
              progressBackgroundColor={Colors.white}
            />
          }
        >
          <SSVStack style={{ marginBottom: 16 }}>
            {sortUtxos([...utxos]).map((utxo) => (
              <SSVStack gap="xs" key={getUtxoOutpoint(utxo)}>
                <SSSeparator color="grayDark" />
                <SSUtxoCard utxo={utxo} />
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
      )}
      <View style={{ flex: 1 }}>
        {view === 'bubbles' && (
          <SSBubbleChart
            utxos={[...utxos]}
            canvasSize={{ width: GRAPH_WIDTH, height: GRAPH_HEIGHT }}
            inputs={[]}
            onPress={({ txid, vout }: AccountUtxo) =>
              router.navigate(
                `/account/${utxo.accountId}/transaction/${txid}/utxo/${vout}`
              )
            }
          />
        )}
      </View>
    </SSMainLayout>
  )
}

export default SpendableOutputs
