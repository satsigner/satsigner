import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import Esplora from '@/api/esplora'
import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useBlockchainStore } from '@/store/blockchain'
import { type Block, type Tx } from '@/types/models/Blockchain'
import { type ExplorerBlockSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

type RequestIdentifier = string

type RequestStatus = {
  id?: RequestIdentifier
  status?: 'unstarted' | 'pending' | 'success' | 'error'
  error?: string
}

type RequestStatuses = Record<RequestIdentifier, RequestStatus>

type Txs = Record<
  Tx['txid'],
  Tx & {
    amount: number
    verbosity: number
  }
>

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()
  const [backend, backendUrl] = useBlockchainStore(
    useShallow((state) => [
      state.configs['bitcoin'].server.backend,
      state.configs['bitcoin'].server.url
    ])
  )
  const esploraClient = new Esplora(backendUrl)

  const [txids, setTxids] = useState<Tx['txid'][]>([])
  const [visibleTxCount, setVisibleTxCount] = useState(10)
  const [txs, setTxs] = useState<Txs>({})
  const [block, setBlock] = useState<Block | undefined>()

  const [requestStatuses, setRequestStatuses] = useState<RequestStatuses>({
    txs: {
      status: 'unstarted'
    }
  })
  // const [block, setBlock] = useState<bitcoinjs.Block | null>(null)

  async function fetchBlockHeight() {
    const data = await esploraClient.getBlockInfo(blockHash)
    setBlock(data)
  }

  async function fetchBlockTransactions() {
    setRequestStatuses((value) => ({
      ...value,
      txs: {
        status: 'pending'
      }
    }))
    const blockTxids = await esploraClient.getBlockTransactionIds(blockHash)
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

    const data = await esploraClient.getTxInfo(txid)

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

  function setTxVerbosity(txid: Tx['txid'], verbosity: number) {
    setTxs((value) => ({
      ...value,
      [txid]: {
        ...value[txid],
        verbosity
      }
    }))
  }

  useEffect(() => {
    if (!blockHash || backend !== 'esplora') return
    fetchBlockHeight()
    fetchBlockTransactions()
  }, [blockHash, backend]) // eslint-disable-line react-hooks/exhaustive-deps

  if (backend !== 'esplora') {
    return (
      <SSMainLayout>
        <SSVStack>
          <SSText>
            This page is only available to Esplora backends. Please choose a
            Esplora-compatible backend in Network Settings.
          </SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

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

                  {tx && tx.verbosity > 0 && (
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
                  {tx && tx.verbosity > 1 && (
                    <SSVStack>
                      {tx.vin.map((vin, index) => {
                        return (
                          <SSVStack key={`${txid}:vin:${index}`}>
                            <SSText>iNPUT {index}</SSText>
                            <SSText>Prev Output Value</SSText>
                            <SSText>{vin.prevout.value}</SSText>
                          </SSVStack>
                        )
                      })}
                    </SSVStack>
                  )}
                  <SSVStack gap="none">
                    {!tx && !requestStatuses[txid]?.status && (
                      <TouchableOpacity onPress={() => loadTxData(txid)}>
                        <SSText color="muted">Show more</SSText>
                      </TouchableOpacity>
                    )}
                    {!tx && requestStatuses[txid]?.status === 'pending' && (
                      <SSHStack gap="sm" style={{ alignItems: 'center' }}>
                        <ActivityIndicator />
                        <SSText color="muted">Loading ...</SSText>
                      </SSHStack>
                    )}
                    {tx && tx.verbosity > 0 && (
                      <TouchableOpacity
                        onPress={() => setTxVerbosity(txid, tx.verbosity - 1)}
                      >
                        <SSText color="muted">Show less</SSText>
                      </TouchableOpacity>
                    )}
                    {tx && tx.verbosity < 2 && (
                      <TouchableOpacity
                        onPress={() => setTxVerbosity(txid, tx.verbosity + 1)}
                      >
                        <SSText color="muted">Show more</SSText>
                      </TouchableOpacity>
                    )}
                  </SSVStack>
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
