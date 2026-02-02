import * as bitcoinjs from 'bitcoinjs-lib'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { type ExplorerBlockSearchParams } from '@/types/navigation/searchParams'

type BlockTransaction = {
  id: string
  // version: number
  // locktime: number
  // hex: string
  // weight: number
  // vsize: number
  // inputs: bitcoinjs.TxInput[]
  // outputs: bitcoinjs.TxOutput[]
  value: number
}

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()
  const mempoolOracle = useMempoolOracle()

  const [transactions, setTransactions] = useState<BlockTransaction[]>([])
  const [loading, setLoading] = useState(false)
  // const [block, setBlock] = useState<bitcoinjs.Block | null>(null)

  async function fetchBlockTransactions() {
    setLoading(true)
    const blockRaw = await mempoolOracle.getBlockRaw(blockHash)
    const block = bitcoinjs.Block.fromBuffer(Buffer.from(blockRaw))
    if (!block.transactions) {
      toast.error('Did not find transactions in this block')
      return
    }
    setTransactions(
      block.transactions.map((tx) => {
        return {
          id: tx.getId(),
          // version: tx.version,
          // locktime: tx.locktime,
          // hex: tx.toHex(),
          // weight: tx.weight(),
          // vsize: tx.virtualSize(),
          // inputs: tx.ins,
          // outputs: tx.outs,
          value: tx.outs.reduce((sum, out) => sum + out.value, 0)
        }
      })
    )
    setLoading(false)
  }

  useEffect(() => {
    fetchBlockTransactions()
  }, [blockHash]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SSMainLayout>
      <ScrollView>
        <SSText>List of transactions for block</SSText>
        <SSButton
          label="FETCH"
          loading={loading}
          onPress={fetchBlockTransactions}
        />
        <SSVStack gap="md">
          {transactions.map((tx) => {
            return (
              <TouchableOpacity key={tx.id}>
                <SSVStack gap="none">
                  <SSText type="mono">{tx.id}</SSText>
                  <SSHStack>
                    <SSText>value:</SSText>
                    <SSStyledSatText amount={tx.id} textSize="sm" />
                  </SSHStack>
                </SSVStack>
              </TouchableOpacity>
            )
          })}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
