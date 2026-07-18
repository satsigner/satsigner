import { FlashList } from '@shopify/flash-list'
import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSExplorerSection from '@/components/SSExplorerSection'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useExplorerAddress } from '@/hooks/useExplorerAddress'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import type { ExplorerAddressUtxo } from '@/types/explorer/address'
import { formatExplorerBackendSource } from '@/utils/explorerCapabilities'
import { formatNumber } from '@/utils/format'

const tn = _tn('explorer.address')

type UtxoRowProps = {
  utxo: ExplorerAddressUtxo
}

function UtxoRow({ utxo }: UtxoRowProps) {
  function openTx() {
    router.push(`/explorer/transaction/${utxo.txid}`)
  }

  return (
    <Pressable onPress={openTx} style={styles.listItem}>
      <SSText type="mono" size="xs">
        {utxo.txid.slice(0, 12)}…:{utxo.vout}
      </SSText>
      <SSText size="sm">{formatNumber(utxo.value)} sats</SSText>
    </Pressable>
  )
}

type TxRowProps = {
  txid: string
}

function TxRow({ txid }: TxRowProps) {
  function openTx() {
    router.push(`/explorer/transaction/${txid}`)
  }

  return (
    <Pressable onPress={openTx} style={styles.listItem}>
      <SSText type="mono" size="xs">
        {txid}
      </SSText>
    </Pressable>
  )
}

function renderUtxo({ item }: { item: ExplorerAddressUtxo }) {
  return <UtxoRow utxo={item} />
}

function renderTx({ item }: { item: string }) {
  return <TxRow txid={item} />
}

function utxoKey(item: ExplorerAddressUtxo) {
  return `${item.txid}:${item.vout}`
}

function txKey(txid: string) {
  return txid
}

export default function ExplorerAddressPage() {
  const [input, setInput] = useState('')
  const [lookupAddress, setLookupAddress] = useState<string | null>(null)

  const {
    data,
    isLoading,
    isError,
    backendSupported,
    capability,
    loadFromMempool,
    ready,
    server,
    useMempool
  } = useExplorerAddress(lookupAddress)

  async function pasteAddress() {
    const text = await Clipboard.getStringAsync()
    if (text) {
      setInput(text.trim())
    }
  }

  function lookup() {
    const next = input.trim()
    if (!next) {
      toast.error(tn('invalid'))
      return
    }
    setLookupAddress(next)
  }

  const sourceLabel = data
    ? data.source === 'backend'
      ? formatExplorerBackendSource(server.name, server.backend)
      : 'mempool.space'
    : null

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <SSVStack gap="md" style={styles.container}>
        <SSTextInput
          value={input}
          onChangeText={setInput}
          placeholder={tn('placeholder')}
          align="center"
        />
        <SSHStack gap="sm">
          <SSButton
            style={styles.half}
            variant="outline"
            label={t('common.paste')}
            onPress={pasteAddress}
          />
          <SSButton
            style={styles.half}
            variant="secondary"
            label={tn('lookup')}
            onPress={lookup}
          />
        </SSHStack>

        {!backendSupported && ready && !useMempool ? (
          <SSExplorerCapabilityBanner
            why={t(capability.whyKey!)}
            fix={t(capability.fixKey!)}
            onLoad={loadFromMempool}
          />
        ) : null}

        {isLoading ? (
          <SSVStack itemsCenter>
            <ActivityIndicator size="large" />
            <SSText>{t('common.loadingDots')}</SSText>
          </SSVStack>
        ) : null}

        {isError ? (
          <SSVStack gap="sm">
            <SSText color="muted">{tn('notFound')}</SSText>
            <SSExplorerCapabilityBanner
              why={t('explorer.capability.addressHistory.rpc.why')}
              fix={t('explorer.capability.addressHistory.rpc.fix')}
              onLoad={loadFromMempool}
            />
          </SSVStack>
        ) : null}

        {data ? (
          <>
            <SSExplorerSection
              title={tn('balance')}
              source={data.source === 'mempool' ? 'mempool' : 'backend'}
              sourceLabel={sourceLabel}
            >
              <SSText weight="bold">
                {formatNumber(data.confirmed + data.unconfirmed)} sats
              </SSText>
              <SSText size="xs" color="muted">
                {tn('confirmed')}: {formatNumber(data.confirmed)} ·{' '}
                {tn('unconfirmed')}: {formatNumber(data.unconfirmed)}
              </SSText>
            </SSExplorerSection>

            <SSExplorerSection title={tn('utxos')}>
              <SSVStack style={styles.listBox}>
                <FlashList
                  data={data.utxos}
                  keyExtractor={utxoKey}
                  renderItem={renderUtxo}
                  ListEmptyComponent={
                    <SSText color="muted" size="sm">
                      {tn('noUtxos')}
                    </SSText>
                  }
                />
              </SSVStack>
            </SSExplorerSection>

            <SSExplorerSection title={tn('transactions')}>
              <SSVStack style={styles.listBox}>
                <FlashList
                  data={data.txids}
                  keyExtractor={txKey}
                  renderItem={renderTx}
                  ListEmptyComponent={
                    <SSText color="muted" size="sm">
                      {tn('noTransactions')}
                    </SSText>
                  }
                />
              </SSVStack>
            </SSExplorerSection>
          </>
        ) : null}
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 24
  },
  half: {
    flex: 1
  },
  listBox: {
    height: 220
  },
  listItem: {
    borderTopColor: Colors.gray[800],
    borderTopWidth: 1,
    gap: 4,
    paddingVertical: 10
  }
})
