import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSDetailsList from '@/components/SSDetailsList'
import SSLoader from '@/components/SSLoader'
import SSMultipleSankeyDiagram from '@/components/SSMultipleSankeyDiagram'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import { SATS_PER_BITCOIN } from '@/constants/btc'
import { useExplorerTransaction } from '@/hooks/useExplorerTransaction'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import type { ExplorerTransaction } from '@/types/models/ExplorerTransaction'
import type { Output } from '@/types/models/Output'
import type { Transaction } from '@/types/models/Transaction'
import type { Utxo } from '@/types/models/Utxo'

const tn = _tn('explorer.transaction')

function buildInputsMap(tx: ExplorerTransaction): Map<string, Utxo> {
  const nonCoinbaseInputs = tx.inputs.filter((inp) => !inp.isCoinbase)
  if (nonCoinbaseInputs.length === 0) {
    return new Map<string, Utxo>()
  }

  const totalOutputValue = tx.outputs.reduce((sum, o) => sum + o.value, 0)
  const approxInputValue = Math.round(
    totalOutputValue / nonCoinbaseInputs.length
  )
  const map = new Map<string, Utxo>()

  for (const inp of nonCoinbaseInputs) {
    map.set(`${inp.prevTxid}:${inp.prevVout}`, {
      keychain: 'external',
      txid: inp.prevTxid,
      value: approxInputValue,
      vout: inp.prevVout
    })
  }
  return map
}

function buildOutputsList(tx: ExplorerTransaction): Output[] {
  return tx.outputs.map((out, i) => ({
    amount: out.value,
    label: tn('output', { index: i.toString() }),
    localId: `output-${i}`,
    to: ''
  }))
}

function buildChartTransaction(tx: ExplorerTransaction): Transaction {
  const totalOutputValue = tx.outputs.reduce((sum, o) => sum + o.value, 0)
  return {
    id: tx.txid,
    lockTimeEnabled: false,
    prices: {},
    received: totalOutputValue,
    sent: 0,
    size: tx.size,
    type: 'receive',
    version: tx.version,
    vin: tx.inputs.map((inp) => ({
      previousOutput: { txid: inp.prevTxid, vout: inp.prevVout },
      scriptSig: inp.scriptSig,
      sequence: inp.sequence,
      witness: []
    })),
    vout: tx.outputs.map((out) => ({
      address: '',
      script: out.script,
      value: out.value
    })),
    vsize: tx.vsize,
    weight: tx.weight
  }
}

export default function ExplorerTransactionDetail() {
  const { txid } = useLocalSearchParams<{ txid: string }>()
  const [showFlow, setShowFlow] = useState(false)

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const sourceLabel = `${server.name} (${server.backend})`

  const resolvedTxid = Array.isArray(txid) ? txid[0] : (txid ?? null)
  const {
    data: tx,
    isLoading,
    isError,
    loadingPhase
  } = useExplorerTransaction(resolvedTxid)

  const inputsMap = tx ? buildInputsMap(tx) : new Map<string, Utxo>()
  const outputsList = tx ? buildOutputsList(tx) : []

  const stackScreen = (
    <Stack.Screen
      options={{
        headerTitle: () => <SSText>{t('transaction.details.title')}</SSText>
      }}
    />
  )

  if (showFlow) {
    return (
      <View style={styles.flex}>
        {stackScreen}
        <SSMultipleSankeyDiagram
          inputs={inputsMap}
          outputs={outputsList}
          feeRate={0}
        />
        <View style={styles.closeButtonContainer}>
          <SSButton
            label={t('common.back')}
            variant="outline"
            onPress={() => setShowFlow(false)}
          />
        </View>
      </View>
    )
  }

  return (
    <ScrollView>
      {stackScreen}
      <SSVStack style={styles.container}>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <SSLoader size={80} />
            {loadingPhase !== null && (
              <SSText size="xxs" type="mono" center style={styles.loadingPhase}>
                {loadingPhase}
              </SSText>
            )}
          </View>
        )}

        {isError && (
          <View style={styles.loadingContainer}>
            <SSText color="muted">{tn('notFound')}</SSText>
          </View>
        )}

        {tx && (
          <>
            {/* Header — matches SSTxDetailsHeader layout */}
            <SSVStack gap="none" style={styles.header}>
              <SSVStack gap="xs" style={styles.headerAmount}>
                <SSHStack gap="xs" style={styles.headerAmountRow}>
                  <SSStyledSatText
                    amount={tx.outputs.reduce((sum, o) => sum + o.value, 0)}
                    decimals={0}
                    noColor
                    weight="light"
                  />
                  <SSText color="muted">{t('bitcoin.sats')}</SSText>
                </SSHStack>
              </SSVStack>
              <SSHStack gap="xs">
                <SSText color="muted">{t('common.from').toLowerCase()}</SSText>
                <SSText>
                  {tx.inputs.length}{' '}
                  {tx.inputs.length === 1
                    ? t('transaction.input.singular').toLowerCase()
                    : t('transaction.input.plural').toLowerCase()}
                </SSText>
                <SSText color="muted">{t('common.to').toLowerCase()}</SSText>
                <SSText>
                  {tx.outputs.length}{' '}
                  {tx.outputs.length === 1
                    ? t('transaction.output.singular').toLowerCase()
                    : t('transaction.output.plural').toLowerCase()}
                </SSText>
              </SSHStack>
            </SSVStack>

            <SSTransactionChart transaction={buildChartTransaction(tx)} />

            {inputsMap.size > 0 && (
              <SSButton
                label={t('transaction.loadHistory')}
                variant="outline"
                onPress={() => setShowFlow(true)}
              />
            )}

            <SSSeparator color="gradient" />

            {/* Txid — matches SSLabelDetails layout */}
            <SSHStack justifyBetween style={styles.txidSection}>
              <SSVStack gap="sm" style={styles.txidContent}>
                <SSText uppercase color="muted">
                  {tn('txid')}
                </SSText>
                <SSClipboardCopy text={tx.txid} fullWidth>
                  <SSText type="mono" size="xs">
                    {tx.txid}
                  </SSText>
                </SSClipboardCopy>
                <SSText size="xxs" style={styles.sourceLabel}>
                  {sourceLabel}
                </SSText>
              </SSVStack>
            </SSHStack>

            <SSSeparator color="gradient" />

            {/* Details grid */}
            <SSDetailsList
              columns={3}
              headerSize="sm"
              textSize="md"
              uppercase={false}
              items={[
                [tn('version'), tx.version.toString()],
                [tn('locktime'), tx.locktime.toString()],
                [tn('size'), `${tx.size} B`],
                [tn('vsize'), `${tx.vsize} vB`],
                [tn('weight'), `${tx.weight} WU`],
                [t('transaction.input.count'), tx.inputs.length.toString()],
                [t('transaction.output.count'), tx.outputs.length.toString()],
                [tn('segwit'), tx.isSegwit ? tn('yes') : tn('no')],
                [tn('coinbase'), tx.isCoinbase ? tn('yes') : tn('no')]
              ]}
            />

            {/* Inputs — matches SSTransactionVinList style */}
            {tx.inputs.map((inp, i) => (
              <SSVStack key={i} style={styles.sectionWithTopPadding}>
                <SSSeparator color="gradient" />
                <SSText size="lg">
                  {t('transaction.input.title')} {i}
                </SSText>
                {inp.isCoinbase ? (
                  <SSText color="muted">{tn('coinbaseInput')}</SSText>
                ) : (
                  <>
                    <SSVStack gap="none">
                      <SSText color="muted">
                        {t('transaction.input.previousOutput.transaction')}
                      </SSText>
                      <SSClipboardCopy text={inp.prevTxid}>
                        <SSText type="mono" size="md">
                          {inp.prevTxid}
                        </SSText>
                      </SSClipboardCopy>
                    </SSVStack>
                    <SSVStack gap="none">
                      <SSText color="muted">
                        {t('transaction.input.previousOutput.vout')}
                      </SSText>
                      <SSText size="lg">{inp.prevVout}</SSText>
                    </SSVStack>
                  </>
                )}
                <SSVStack gap="none">
                  <SSText color="muted">
                    {t('transaction.input.sequence')}
                  </SSText>
                  <SSText size="lg">{`0x${inp.sequence.toString(16).padStart(8, '0')}`}</SSText>
                </SSVStack>
                {inp.witness.length > 0 && (
                  <SSVStack gap="none">
                    <SSText color="muted">
                      {tn('witness', { count: inp.witness.length.toString() })}
                    </SSText>
                    {inp.witness.map((w, wi) => (
                      <SSClipboardCopy key={wi} text={w}>
                        <SSText type="mono" size="xxs">
                          {w}
                        </SSText>
                      </SSClipboardCopy>
                    ))}
                  </SSVStack>
                )}
              </SSVStack>
            ))}

            {/* Outputs — matches SSTransactionVoutList style */}
            {tx.outputs.map((out) => (
              <SSVStack key={out.index} style={styles.sectionWithTopPadding}>
                <SSSeparator color="gradient" />
                <SSText size="lg">
                  {t('transaction.output.title')} {out.index}
                </SSText>
                <SSVStack gap="none">
                  <SSText color="muted">{t('transaction.value')}</SSText>
                  <SSText size="lg">{out.value.toLocaleString()}</SSText>
                </SSVStack>
                <SSVStack gap="none">
                  <SSText color="muted">
                    {`${(out.value / SATS_PER_BITCOIN).toFixed(8).replace(/\.?0+$/, '')} BTC`}
                  </SSText>
                </SSVStack>
                <SSVStack>
                  <SSText color="muted">{tn('script')}</SSText>
                  <SSClipboardCopy text={out.script}>
                    <SSText type="mono" size="xxs">
                      {out.script}
                    </SSText>
                  </SSClipboardCopy>
                </SSVStack>
              </SSVStack>
            ))}
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  closeButtonContainer: {
    bottom: 32,
    paddingHorizontal: 16,
    position: 'absolute',
    width: '100%'
  },
  container: {
    flexDirection: 'column',
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: 20
  },
  flex: { flex: 1 },
  header: { alignItems: 'center' },
  headerAmount: { alignItems: 'center', marginTop: 16 },
  headerAmountRow: { alignItems: 'baseline', width: 'auto' },
  loadingContainer: { alignItems: 'center', gap: 16, paddingVertical: 60 },
  loadingPhase: { opacity: 0.6 },
  sectionWithTopPadding: { paddingTop: 50 },
  sourceLabel: { color: Colors.mainGreen, opacity: 0.8 },
  txidContent: { flex: 1 },
  txidSection: { alignItems: 'flex-start' }
})
