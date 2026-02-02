import * as bitcoinjs from 'bitcoinjs-lib'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { type ExplorerBlockSearchParams } from '@/types/navigation/searchParams'

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()
  const mempoolOracle = useMempoolOracle()

  const [transactions, setTransactions] = useState<bitcoinjs.Transaction[]>([])
  const [focusedTx, setFocusedTx] = useState(-1)
  const [loading, setLoading] = useState(false)
  // const [block, setBlock] = useState<bitcoinjs.Block | null>(null)

  async function fetchBlockTransactions() {
    setLoading(true)
    const blockRaw = await mempoolOracle.getBlockRaw(blockHash)
    const block = bitcoinjs.Block.fromBuffer(Buffer.from(blockRaw))
    setTransactions(block.transactions || [])
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
          {transactions.map((tx, index) => {
            return (
              <TouchableOpacity
                key={tx.getId()}
                onPress={() => setFocusedTx(index)}
              >
                <SSVStack>
                  <SSText type="mono">{tx.getId()}</SSText>
                  {focusedTx === index && (
                    <SSTransactionDecoded txHex={tx.toHex()} />
                  )}
                </SSVStack>
              </TouchableOpacity>
            )
          })}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
