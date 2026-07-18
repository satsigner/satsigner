import { FlashList } from '@shopify/flash-list'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSExplorerTxSizeBars from '@/components/SSExplorerTxSizeBars'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import { useExplorerBlockTransactions } from '@/hooks/useExplorerBlockTransactions'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ExplorerBlockSearchParams } from '@/types/navigation/searchParams'
import { formatExplorerBackendSource } from '@/utils/explorerCapabilities'

const INITIAL_VISIBLE = 20
const PAGE_SIZE = 20

type TxRowProps = {
  txid: string
  index: number
}

function TxRow({ txid, index }: TxRowProps) {
  function openTransaction() {
    router.push(`/explorer/transaction/${txid}`)
  }

  return (
    <SSVStack gap="none" style={styles.txListItem}>
      <SSText weight="bold">
        {index === 0 ? `#${index} [${t('transaction.coinbase')}]` : `#${index}`}
      </SSText>
      <SSClipboardCopy text={txid}>
        <SSText type="mono">{txid}</SSText>
      </SSClipboardCopy>
      <Pressable onPress={openTransaction}>
        <SSText size="xs" color="muted">
          {t('common.showMore')}
        </SSText>
      </Pressable>
    </SSVStack>
  )
}

function renderTxRow({ item, index }: { item: string; index: number }) {
  return <TxRow txid={item} index={index} />
}

function txKeyExtractor(txid: string) {
  return txid
}

export default function BlockTransactions() {
  const { block: blockHash } = useLocalSearchParams<ExplorerBlockSearchParams>()
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)

  const {
    data,
    isLoading,
    isError,
    error,
    capability,
    loadFromMempool,
    server,
    useMempool
  } = useExplorerBlockTransactions(blockHash)

  function showMore() {
    setVisibleCount((count) => count + PAGE_SIZE)
  }

  if (isLoading) {
    return (
      <SSMainLayout>
        <View style={styles.loadingContainer}>
          <SSLoader size={80} />
        </View>
      </SSMainLayout>
    )
  }

  if (isError || !data) {
    return (
      <SSMainLayout>
        <SSVStack gap="sm">
          <SSText>
            {error instanceof Error
              ? error.message
              : t('explorer.block.transactions.wrongBackend')}
          </SSText>
          {!useMempool ? (
            <SSExplorerCapabilityBanner
              why={t(
                capability.whyKey ??
                  'explorer.capability.blockTxList.electrum.why'
              )}
              fix={t(
                capability.fixKey ??
                  'explorer.capability.blockTxList.electrum.fix'
              )}
              onLoad={loadFromMempool}
            />
          ) : null}
        </SSVStack>
      </SSMainLayout>
    )
  }

  const visibleTxids = data.txids.slice(0, visibleCount)
  const sourceLabel =
    data.source === 'backend'
      ? formatExplorerBackendSource(server.name, server.backend)
      : 'mempool.space'
  const canLoadMore = visibleCount < data.txids.length

  return (
    <SSMainLayout>
      <SSVStack gap="sm" style={styles.container}>
        <SSVStack itemsCenter gap="xxs">
          <SSText center size="md">
            {t('explorer.block.transactions.title', {
              block: data.height ?? '?'
            })}
          </SSText>
          <SSText size="xxs" style={styles.sourceLabel}>
            {sourceLabel}
          </SSText>
        </SSVStack>
        <SSExplorerTxSizeBars
          sizes={data.sizes}
          totalTxCount={data.txids.length}
        />
        <FlashList
          data={visibleTxids}
          keyExtractor={txKeyExtractor}
          onEndReached={canLoadMore ? showMore : undefined}
          onEndReachedThreshold={0.4}
          renderItem={renderTxRow}
          ListFooterComponent={
            canLoadMore ? (
              <SSHStack style={styles.footer}>
                <SSText size="xs" color="muted">
                  {t('common.loadMore')}
                </SSText>
              </SSHStack>
            ) : null
          }
        />
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  footer: {
    justifyContent: 'center',
    paddingVertical: 12
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60
  },
  sourceLabel: {
    color: Colors.gray[500]
  },
  txListItem: {
    borderTopColor: Colors.barGray,
    borderTopWidth: 1,
    paddingVertical: 8
  }
})
