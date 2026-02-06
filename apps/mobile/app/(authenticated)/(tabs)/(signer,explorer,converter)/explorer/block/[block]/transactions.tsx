import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'

import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { type Block, type Tx } from '@/types/models/Blockchain'
import { type ExplorerBlockSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

type RequestIdentifier = string

type RequestStatus = Record<
  RequestIdentifier,
  {
    status?: 'unstarted' | 'pending' | 'success' | 'error'
    error?: string
  }
>

type Txs = Record<
  Tx['txid'],
  Tx & {
    amount: number
    verbosity: 0 | 1 | 2 // verbosity shown
  }
>

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()
  const mempoolOracle = useMempoolOracle()

  const [txids, setTxids] = useState<Tx['txid'][]>([])
  const [visibleTxCount, setVisibleTxCount] = useState(10)
  const [txs, setTxs] = useState<Txs>({})
  const [block, setBlock] = useState<Block | undefined>()

  const [requestStatuses, setRequestStatuses] = useState<RequestStatus>({
    txs: {
      status: 'unstarted'
    }
  })
  // const [block, setBlock] = useState<bitcoinjs.Block | null>(null)

  async function fetchBlockHeight() {
    const data = await mempoolOracle.getBlock(blockHash)
    setBlock(data)
  }

  async function fetchBlockTransactions() {
    setRequestStatuses((value) => ({
      ...value,
      txs: {
        status: 'pending'
      }
    }))
    const blockTxids = await mempoolOracle.getBlockTransactionIds(blockHash)
    setTxids(blockTxids)

    setRequestStatuses((value) => ({
      ...value,
      txs: {
        status: 'success'
      }
    }))
  }

  function showMoreTxIds() {
    setVisibleTxCount((currentValue) => currentValue + 10)
  }

  async function loadTxData(txid: Tx['txid']) {
    setRequestStatuses((value) => ({
      ...value,
      [txid]: {
        status: 'pending'
      }
    }))

    const data = await mempoolOracle.getTransaction(txid)

    setTxs((currentValue) => ({
      ...currentValue,
      [txid]: {
        ...data,
        amount: data.vout.reduce((val, out) => val + out.value, 0),
        verbosity: 1
      }
    }))

    setRequestStatuses((value) => ({
      ...value,
      [txid]: {
        status: 'success'
      }
    }))
  }

  useEffect(() => {
    fetchBlockHeight()
    fetchBlockTransactions()
  }, [blockHash]) // eslint-disable-line react-hooks/exhaustive-deps

  if (requestStatuses['txs']?.status === 'error') {
    return (
      <SSMainLayout>
        <SSVStack gap="sm">
          <SSHStack
            style={{ alignContent: 'center', justifyContent: 'center' }}
            gap="sm"
          >
            <SSIconWarning height={16} width={16} />
            <SSText>Error while fetching transactions</SSText>
            <SSIconWarning height={16} width={16} />
          </SSHStack>
          <SSText center type="mono">
            {requestStatuses['txs'].error}
          </SSText>
          <SSButton label="FETCH" onPress={fetchBlockTransactions} />
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (requestStatuses['txs']?.status === 'pending') {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter>
          <SSText size="md">Loading block transactions... </SSText>
          <ActivityIndicator size="large" />
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <ScrollView>
        <SSVStack>
          <SSVStack itemsCenter gap="none">
            <SSText center size="md">
              {`Transactions — Block #${block?.height}`}
            </SSText>
          </SSVStack>
          <SSVStack gap="md">
            {txids.slice(0, visibleTxCount).map((txid, index) => {
              const tx = txs[txid]
              return (
                <SSVStack key={txid} gap="sm">
                  <SSText size="xs" weight="bold">
                    {index !== 0 ? `#${index}` : `#${index} [MINER COINBASE]`}
                  </SSText>
                  <SSClipboardCopy text={txid}>
                    <SSText type="mono">{txid}</SSText>
                  </SSClipboardCopy>

                  {tx && (
                    <SSVStack gap="xs">
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Amount</SSText>
                          <SSText color="muted">
                            {formatNumber(tx.amount)}
                          </SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Fee</SSText>
                          <SSText color="muted">{formatNumber(tx.fee)}</SSText>
                        </SSVStack>
                      </SSHStack>
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Inputs</SSText>
                          <SSText color="muted">{tx.vin.length}</SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Outputs</SSText>
                          <SSText color="muted">{tx.vout.length}</SSText>
                        </SSVStack>
                      </SSHStack>
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Locktime</SSText>
                          <SSText color="muted">{tx.locktime}</SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">Version</SSText>
                          <SSText color="muted">{tx.version}</SSText>
                        </SSVStack>
                      </SSHStack>
                    </SSVStack>
                  )}
                  {!tx && (
                    <SSHStack
                      gap="sm"
                      style={{
                        alignItems: 'center',
                        justifyContent: 'flex-start'
                      }}
                    >
                      {!requestStatuses[txid]?.status && (
                        <TouchableOpacity onPress={() => loadTxData(txid)}>
                          <SSText color="muted">Show more</SSText>
                        </TouchableOpacity>
                      )}
                      {requestStatuses[txid]?.status === 'pending' && (
                        <>
                          <ActivityIndicator />
                          <SSText color="muted">Loading ...</SSText>
                        </>
                      )}
                    </SSHStack>
                  )}
                </SSVStack>
              )
            })}
          </SSVStack>
          <SSButton label="Load more" onPress={showMoreTxIds} />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}
