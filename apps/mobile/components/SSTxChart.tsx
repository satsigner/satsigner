import { useWindowDimensions, View } from 'react-native'

import { type Transaction } from '@/types/models/Transaction'

import SSSingleSankeyDiagram from './SSSingleSankeyDiagram'

type SSTxChartProps = {
  transaction: Transaction
}

function SSTxChart({ transaction }: SSTxChartProps) {
  const { height } = useWindowDimensions()
  const diagramHeight = height * 0.34

  if (!transaction.vin || !transaction.vout) return null
  if (transaction.vin.some((vin) => !vin.value)) return null

  return (
    <View style={{ height: diagramHeight }}>
      <SSSingleSankeyDiagram
        inputs={transaction.vin.map((input) => ({
          label: '',
          txid: input.previousOutput.txid,
          value: input.value || 0
        }))}
        outputs={transaction.vout.map((output) => ({
          label: '',
          address: output.address,
          value: output.value
        }))}
        size={transaction.size ?? 0}
      />
    </View>
  )
}

export default SSTxChart
