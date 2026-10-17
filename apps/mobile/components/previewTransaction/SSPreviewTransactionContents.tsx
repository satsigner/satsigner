import { type ComponentProps } from 'react'
import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'

const tn = _tn('transaction.build.preview')

const TRANSACTION_CHART_SCALE = 0.9

type SSPreviewTransactionContentsProps = Pick<
  ComponentProps<typeof SSTransactionChart>,
  | 'knownTxIds'
  | 'onOpenLinkedTx'
  | 'outpointLabelsByRef'
  | 'ownAddresses'
  | 'transaction'
  | 'txLabelsById'
>

function SSPreviewTransactionContents({
  knownTxIds,
  onOpenLinkedTx,
  outpointLabelsByRef,
  ownAddresses,
  transaction,
  txLabelsById
}: SSPreviewTransactionContentsProps) {
  return (
    <SSVStack gap="xxs">
      <SSText color="muted" size="sm" uppercase>
        {tn('contents')}
      </SSText>
      <View style={styles.chartContainer}>
        <SSTransactionChart
          knownTxIds={knownTxIds}
          onOpenLinkedTx={onOpenLinkedTx}
          outpointLabelsByRef={outpointLabelsByRef}
          ownAddresses={ownAddresses}
          transaction={transaction}
          txLabelsById={txLabelsById}
          scale={TRANSACTION_CHART_SCALE}
          showUnspentLabel={false}
        />
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  chartContainer: { overflow: 'hidden' }
})

export default SSPreviewTransactionContents
