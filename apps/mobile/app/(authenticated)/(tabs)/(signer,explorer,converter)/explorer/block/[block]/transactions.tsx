import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { toast } from 'sonner-native'
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
import type { Block, Tx } from '@/types/models/Blockchain'
import type { ExplorerBlockSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import {
  updateNestedObject,
  updateNestedObjectPartially
} from '@/utils/objects'
import {
  markPromiseError,
  markPromisePending,
  markPromiseSuccessful,
  type PromiseStatuses,
  updatePromiseStatus
} from '@/utils/promises'

type Txs = Record<
  Tx['txid'],
  Tx & {
    amount: number
    verbosity: number
  }
>

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()

  const [backend, esploraClient] = useBlockchainStore(
    useShallow((state) => [
      state.configs['bitcoin'].server.backend,
      new Esplora(state.configs['bitcoin'].server.url)
    ])
  )

  const [block, setBlock] = useState<Block | undefined>()
  const [blockTxs, setBlockTxs] = useState<Txs>({})
  const [blockTxids, setBlockTxids] = useState<Tx['txid'][]>([])
  const [visibleTxCount, setVisibleTxCount] = useState(10)
  const [requestStatuses, setRequestStatuses] = useState<PromiseStatuses>({
    txs: { status: 'unstarted' }
  })

  async function fetchBlock() {
    const data = await esploraClient.getBlockInfo(blockHash)
    setBlock(data)
  }

  async function fetchBlockTransactions() {
    setRequestStatuses((value) => updatePromiseStatus(value, 'tx', 'pending'))
    try {
      const blockTxids = await esploraClient.getBlockTransactionIds(blockHash)
      setBlockTxids(blockTxids)
      setRequestStatuses((value) => updatePromiseStatus(value, 'tx', 'success'))
    } catch {
      const err = 'Failed to fetch block transactions'
      setRequestStatuses((value) => markPromiseError(value, 'txs', err))
      toast.error(err)
    }
  }

  function showMoreTxIds() {
    setVisibleTxCount((currentValue) => currentValue + 10)
  }

  async function loadTxData(txid: Tx['txid']) {
    setRequestStatuses((value) => markPromisePending(value, txid))

    try {
      const txInfo = await esploraClient.getTxInfo(txid)
      setBlockTxs((txs) =>
        updateNestedObject(txs, txid, {
          ...txInfo,
          amount: txInfo.vout.reduce((val, out) => val + out.value, 0),
          verbosity: 1
        })
      )
      setRequestStatuses((value) => markPromiseSuccessful(value, txid))
    } catch {
      const err = 'Failed to get tx info'
      setRequestStatuses((value) => markPromiseError(value, txid, err))
      toast.error(err)
    }
  }

  function setTxVerbosity(txid: Tx['txid'], verbosity: number) {
    setBlockTxs((txs) =>
      updateNestedObjectPartially(txs, txid, 'verbosity', verbosity)
    )
  }

  useEffect(() => {
    if (!blockHash || backend !== 'esplora') return
    fetchBlock()
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
            {blockTxids.slice(0, visibleTxCount).map((txid, index) => {
              const tx = blockTxs[txid]
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
