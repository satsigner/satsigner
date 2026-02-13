import { useLocalSearchParams } from 'expo-router'
import { produce } from 'immer'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import Esplora from '@/api/esplora'
import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSTransactionVinList from '@/components/SSTransactionVinList'
import SSTransactionVoutList from '@/components/SSTransactionVoutList'
import { usePromiseStatuses } from '@/hooks/usePromiseStatus'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import type { Block, Tx } from '@/types/models/Blockchain'
import type { ExplorerBlockSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'

type Transations = Record<
  Tx['txid'],
  Tx & { amount: number; verbosity: number }
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
  const [blockTxs, setBlockTxs] = useState<Transations>({})
  const [blockTxids, setBlockTxids] = useState<Tx['txid'][]>([])
  const [visibleTxCount, setVisibleTxCount] = useState(10)
  const { statuses: requestStatuses, runPromise: runRequest } =
    usePromiseStatuses(['tx'])

  async function fetchBlock() {
    const data = await esploraClient.getBlockInfo(blockHash)
    setBlock(data)
  }

  async function fetchBlockTransactions() {
    await runRequest({
      name: 'tx',
      callback: async () => {
        const blockTxids = await esploraClient.getBlockTransactionIds(blockHash)
        setBlockTxids(blockTxids)
      },
      errorMessage: 'Failed to fetch block transactions'
    })
  }

  function showMoreTxIds() {
    setVisibleTxCount((currentValue) => currentValue + 10)
  }

  async function loadTxData(txid: Tx['txid']) {
    await runRequest({
      name: txid,
      callback: async () => {
        const txInfo = await esploraClient.getTxInfo(txid)
        setBlockTxs((txs) =>
          produce(txs, (draft) => {
            draft[txid] = {
              ...txInfo,
              amount: txInfo.vout.reduce((val, out) => val + out.value, 0),
              verbosity: 1
            }
          })
        )
      },
      errorMessage: 'Failed to get tx info'
    })
  }

  function setTxVerbosity(txid: Tx['txid'], verbosity: number) {
    setBlockTxs((txs) =>
      produce(txs, (draft) => {
        draft[txid]['verbosity'] = verbosity
      })
    )
  }

  useEffect(() => {
    if (!blockHash || backend !== 'esplora') return
    if (!block) fetchBlock()
    if (Object.keys(blockTxs).length === 0) fetchBlockTransactions()
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
          <SSVStack gap="none">
            {blockTxids.slice(0, visibleTxCount).map((txid, index) => {
              const tx = blockTxs[txid]
              return (
                <SSVStack key={txid} gap="none" style={styles.txListItem}>
                  <SSText weight="bold">
                    {index !== 0
                      ? `#${index}`
                      : `#${index} [${t('transaction.coinbase')}]`}
                  </SSText>
                  <SSClipboardCopy text={txid}>
                    <SSText type="mono">{txid}</SSText>
                  </SSClipboardCopy>
                  {tx?.verbosity > 0 && (
                    <SSVStack gap="xs" style={{ marginVertical: 20 }}>
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">{t('common.amount')}</SSText>
                          <SSText color="muted">
                            {formatNumber(tx.amount)}
                          </SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">{t('preview.fee')}</SSText>
                          <SSText color="muted">{formatNumber(tx.fee)}</SSText>
                        </SSVStack>
                      </SSHStack>
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">
                            {t('preview.inputPlural')}
                          </SSText>
                          <SSText color="muted">{tx.vin.length}</SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">{t('preview.outputs')}</SSText>
                          <SSText color="muted">{tx.vout.length}</SSText>
                        </SSVStack>
                      </SSHStack>
                      <SSHStack gap="none">
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">
                            {t('transaction.decoded.label.locktime')}
                          </SSText>
                          <SSText color="muted">{tx.locktime}</SSText>
                        </SSVStack>
                        <SSVStack style={{ width: '50%' }} gap="none">
                          <SSText weight="bold">
                            {t('transaction.decoded.label.version')}
                          </SSText>
                          <SSText color="muted">{tx.version}</SSText>
                        </SSVStack>
                      </SSHStack>
                    </SSVStack>
                  )}
                  {tx?.verbosity > 1 && (
                    <SSVStack gap="xs" style={{ marginBottom: 20 }}>
                      {index > 0 && (
                        <SSTransactionVinList
                          vin={tx.vin.map((input) => {
                            return {
                              previousOutput: {
                                txid: input.txid,
                                vout: input.vout
                              },
                              sequence: input.sequence,
                              scriptSig: input.scriptsig_asm,
                              value: input.prevout.value,
                              witness: []
                            }
                          })}
                        />
                      )}
                      <SSTransactionVoutList
                        vout={tx.vout.map((output) => {
                          return {
                            value: output.value,
                            address: output.scriptpubkey_address || '',
                            script: output.scriptpubkey_asm || []
                          }
                        })}
                        txid={tx.txid}
                      />
                    </SSVStack>
                  )}
                  <SSVStack gap="none">
                    {!tx && !requestStatuses[txid]?.status && (
                      <TouchableOpacity onPress={() => loadTxData(txid)}>
                        <SSText size="xs" color="muted">
                          {t('common.showMore')}
                        </SSText>
                      </TouchableOpacity>
                    )}
                    {!tx && requestStatuses[txid]?.status === 'pending' && (
                      <SSHStack gap="sm" style={{ alignItems: 'center' }}>
                        <ActivityIndicator />
                        <SSText size="xs" color="muted">
                          {t('common.loadingx')}
                        </SSText>
                      </SSHStack>
                    )}
                    {tx && tx.verbosity > 0 && (
                      <TouchableOpacity
                        onPress={() => setTxVerbosity(txid, tx.verbosity - 1)}
                      >
                        <SSText size="xs" color="muted">
                          {t('common.showLess')}
                        </SSText>
                      </TouchableOpacity>
                    )}
                    {tx && tx.verbosity < 2 && (
                      <TouchableOpacity
                        onPress={() => setTxVerbosity(txid, tx.verbosity + 1)}
                      >
                        <SSText size="xs" color="muted">
                          {t('common.showMore')}
                        </SSText>
                      </TouchableOpacity>
                    )}
                  </SSVStack>
                </SSVStack>
              )
            })}
          </SSVStack>
          <SSButton label={t('common.loadMore')} onPress={showMoreTxIds} />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  txListItem: {
    borderTopColor: Colors.barGray,
    paddingVertical: 8,
    borderTopWidth: 1
  }
})
