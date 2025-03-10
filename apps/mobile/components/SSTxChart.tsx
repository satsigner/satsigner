import { useMemo } from 'react'
import { useWindowDimensions, View } from 'react-native'

import { type Transaction } from '@/types/models/Transaction'
import { formatAddress } from '@/utils/format'

import SSSankeyDiagram from './SSSankeyDiagram'

type SSTxChartProps = {
  transaction: Transaction
}

function SSTxChart({ transaction }: SSTxChartProps) {
  const sankeyNodes = useMemo(() => {
    const vinCount = transaction.vin.length

    const inputNodes = transaction.vin.map((input, index) => ({
      id: String(index + 1),
      indexC: index + 1,
      depthH: 1,
      type: 'text',
      textInfo: [
        String(input.value !== undefined ? input.value : '?'),
        formatAddress(input.previousOutput.txid, 3),
        ''
      ],
      value: input.value || 0
    }))

    const blockNode = {
      id: String(vinCount + 1),
      indexC: vinCount + 1,
      depthH: 2,
      type: 'block',
      textInfo: [formatAddress(transaction.id, 3), '', '', '']
    }

    const outputNodes = transaction.vout.map((output, index) => ({
      id: String(vinCount + 2 + index),
      indexC: vinCount + 2 + index,
      depthH: 3,
      type: 'text',
      textInfo: [String(output.value), output.address, ''],
      value: output.value
    }))

    return [...inputNodes, blockNode, ...outputNodes]
  }, [transaction])

  const sankeyLinks = useMemo(() => {
    const vinCount = transaction.vin.length

    const inputToBlockLinks = transaction.vin.map((input, index) => ({
      source: String(index + 1),
      target: String(vinCount + 1),
      value: input.value || 0
    }))

    const blockToOutputLinks = transaction.vout.map((output, index) => ({
      source: String(vinCount + 1),
      target: String(vinCount + 2 + index),
      value: output.value
    }))

    return [...inputToBlockLinks, ...blockToOutputLinks]
  }, [transaction])

  const { height } = useWindowDimensions()
  const diagramHeight = height * 0.34

  return (
    <View style={{ height: diagramHeight }}>
      <SSSankeyDiagram
        sankeyLinks={sankeyLinks}
        sankeyNodes={sankeyNodes}
        inputCount={transaction.vin.length}
      />
    </View>
  )
}

export default SSTxChart
