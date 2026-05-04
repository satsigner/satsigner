import { useQuery } from '@tanstack/react-query'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { MempoolOracle } from '@/api/blockchain'
import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSDetailsList from '@/components/SSDetailsList'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE
} from '@/constants/headerChrome'
import { useLND } from '@/hooks/useLND'
import { useLndNodeDashboard } from '@/hooks/useLndNodeDashboard'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type {
  LndInvoice,
  LndOnchainTransaction,
  LndPayment
} from '@/types/lndNodeDashboard'
import type { LNDGraphNodeInfo } from '@/types/models/LND'
import { formatFiatPrice, formatNumber } from '@/utils/format'
import { formatLightningTxTimeAgo } from '@/utils/lndTransactionDisplay'

const PRIVACY_MASK = '••••'

function formatUnixTimestamp(unixSeconds: number): string {
  if (!unixSeconds) {
    return '—'
  }
  return new Date(unixSeconds * 1000).toLocaleString('en-US', {
    day: 'numeric',
    hour: 'numeric',
    hour12: true,
    minute: 'numeric',
    month: 'long',
    second: 'numeric',
    year: 'numeric'
  })
}

function statusBadgeContainerStyle(isPositive: boolean, isNegative: boolean) {
  if (isPositive) {
    return styles.statusBadgePositive
  }
  if (isNegative) {
    return styles.statusBadgeNegative
  }
  return styles.statusBadgeNeutral
}

function statusBadgeTextStyle(isPositive: boolean, isNegative: boolean) {
  if (isPositive) {
    return styles.statusTextPositive
  }
  if (isNegative) {
    return styles.statusTextNegative
  }
  return styles.statusTextNeutral
}

function StatusBadge({ status }: { status: string }) {
  const isPositive = ['settled', 'succeeded', 'confirmed'].includes(
    status.toLowerCase()
  )
  const isNegative = ['canceled', 'failed'].includes(status.toLowerCase())

  return (
    <View
      style={[
        styles.statusBadge,
        statusBadgeContainerStyle(isPositive, isNegative)
      ]}
    >
      <SSText
        size="xs"
        weight="medium"
        style={statusBadgeTextStyle(isPositive, isNegative)}
      >
        {status.toUpperCase()}
      </SSText>
    </View>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <SSText size="xs" color="muted" uppercase weight="medium">
        {label}
      </SSText>
      <View style={styles.sectionDivider} />
    </View>
  )
}

type Hop = LndPayment['htlcs'][0]['route']['hops'][0]

function shortPubkey(pk: string): string {
  if (!pk) {
    return '—'
  }
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`
}

function HopDiagram({
  hops,
  nodeInfoMap,
  privacyMode
}: {
  hops: Hop[]
  nodeInfoMap: Record<string, LNDGraphNodeInfo | null>
  privacyMode: boolean
}) {
  if (hops.length === 0) {
    return null
  }

  return (
    <SSVStack gap="md">
      <SectionHeader label={t('lightning.node.txDetail.section.routeMap')} />
      <View style={styles.hopDiagram}>
        <View style={styles.hopNodeRow}>
          <View style={[styles.hopDot, styles.hopDotHighlight]} />
          <SSText size="xs" weight="medium" style={styles.hopLabel}>
            {t('lightning.node.txDetail.sender')}
          </SSText>
        </View>

        {hops.map((hop, i) => {
          const isLast = i === hops.length - 1
          const info = nodeInfoMap[hop.pub_key] ?? null
          const nodeColor = info?.color
          const alias = info?.alias
          const pubkeyLabel = privacyMode
            ? PRIVACY_MASK
            : shortPubkey(hop.pub_key)

          return (
            <View key={hop.chan_id ?? i}>
              <View style={styles.hopEdgeRow}>
                <View style={styles.hopEdgeLineCol}>
                  <View style={styles.hopEdgeLine} />
                  <SSText size="xxs" style={styles.hopArrow}>
                    ▼
                  </SSText>
                </View>
                <View style={styles.hopEdgeMeta}>
                  <SSText
                    size="xxs"
                    color="muted"
                    style={styles.hopEdgeChanId}
                    numberOfLines={1}
                  >
                    {hop.chan_id}
                  </SSText>
                  {!privacyMode && (
                    <>
                      <SSText size="xxs" color="muted">
                        {hop.amt_to_forward} sat
                      </SSText>
                      {hop.fee && hop.fee !== '0' && (
                        <SSText size="xxs" color="muted">
                          fee {hop.fee} sat / {hop.fee_msat} msat
                        </SSText>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={styles.hopNodeRow}>
                <View
                  style={[
                    styles.hopDot,
                    isLast && styles.hopDotHighlight,
                    nodeColor
                      ? { backgroundColor: nodeColor, borderColor: nodeColor }
                      : null
                  ]}
                />
                <SSVStack gap="none" style={styles.hopLabel}>
                  {alias && !privacyMode ? (
                    <>
                      <SSText size="xs" weight="medium" numberOfLines={1}>
                        {alias}
                      </SSText>
                      <SSText
                        size="xxs"
                        color="muted"
                        style={styles.hopLabelMono}
                        numberOfLines={1}
                      >
                        {pubkeyLabel}
                      </SSText>
                    </>
                  ) : (
                    <SSText
                      size="xs"
                      style={styles.hopLabelMono}
                      numberOfLines={1}
                    >
                      {pubkeyLabel}
                    </SSText>
                  )}
                </SSVStack>
              </View>
            </View>
          )
        })}
      </View>
    </SSVStack>
  )
}

function hopFeeMsatWithPct(feeMsat: string, amtMsat: string): string {
  const fee = Number(feeMsat)
  const amt = Number(amtMsat)
  if (!amt) {
    return feeMsat
  }
  const pct = ((fee / amt) * 100).toFixed(3)
  return `${feeMsat} (${pct}%)`
}

function PaymentDetail({
  nodeInfoMap,
  payment,
  privacyMode
}: {
  nodeInfoMap: Record<string, LNDGraphNodeInfo | null>
  payment: LndPayment
  privacyMode: boolean
}) {
  const htlcCount = payment.htlcs?.length ?? 0
  const firstRoute = payment.htlcs?.[0]?.route
  const hops = firstRoute?.hops ?? []

  return (
    <SSVStack gap="lg">
      <SSVStack gap="md">
        <SectionHeader label={t('lightning.node.txDetail.section.payment')} />
        <SSDetailsList
          columns={2}
          gap={16}
          variant="mono"
          copyToClipboard
          items={[
            [
              t('lightning.node.txDetail.paymentHash'),
              privacyMode ? PRIVACY_MASK : payment.payment_hash,
              { width: '100%' }
            ],
            [
              t('lightning.node.txDetail.preimage'),
              privacyMode ? PRIVACY_MASK : payment.payment_preimage,
              { width: '100%' }
            ]
          ]}
        />
        <SSDetailsList
          columns={2}
          gap={16}
          items={[
            [
              t('lightning.node.txDetail.valueSat'),
              privacyMode ? PRIVACY_MASK : payment.value_sat
            ],
            [
              t('lightning.node.txDetail.valueMsat'),
              privacyMode ? PRIVACY_MASK : payment.value_msat
            ],
            [
              t('lightning.node.txDetail.feeSat'),
              privacyMode ? PRIVACY_MASK : payment.fee_sat
            ],
            [
              t('lightning.node.txDetail.feeMsat'),
              privacyMode ? PRIVACY_MASK : payment.fee_msat
            ],
            [
              t('lightning.node.txDetail.created'),
              formatUnixTimestamp(Number(payment.creation_date))
            ],
            [t('lightning.node.txDetail.htlcs'), String(htlcCount)]
          ]}
        />
        {payment.payment_request ? (
          <SSDetailsList
            columns={1}
            gap={8}
            variant="mono"
            copyToClipboard
            items={[
              [
                t('lightning.node.txDetail.paymentRequest'),
                privacyMode ? PRIVACY_MASK : payment.payment_request
              ]
            ]}
          />
        ) : null}
      </SSVStack>

      {hops.length > 0 && (
        <SSVStack gap="sm">
          <SectionHeader label={t('lightning.node.txDetail.section.route')} />
          {hops.map((hop, i) => {
            const info = nodeInfoMap[hop.pub_key] ?? null
            const nodeColor = info?.color
            const alias = info?.alias

            return (
              <View key={hop.chan_id ?? i} style={styles.hopCard}>
                <SSHStack gap="sm" style={styles.hopCardHeader}>
                  <SSVStack gap="none" style={{ flex: 1 }}>
                    <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                      {nodeColor && (
                        <View
                          style={[
                            styles.hopCardDot,
                            {
                              backgroundColor: nodeColor,
                              borderColor: nodeColor
                            }
                          ]}
                        />
                      )}
                      <SSText size="xs" weight="medium" numberOfLines={1}>
                        {alias && !privacyMode
                          ? alias
                          : shortPubkey(hop.pub_key)}
                      </SSText>
                    </SSHStack>
                  </SSVStack>
                  <View style={styles.hopIndexBadge}>
                    <SSText size="xxs" style={styles.hopIndexBadgeText}>
                      {t('lightning.node.txDetail.hop', {
                        index: String(i + 1)
                      })}
                    </SSText>
                  </View>
                </SSHStack>
                <SSDetailsList
                  columns={2}
                  gap={12}
                  items={[
                    [
                      t('lightning.node.txDetail.pubKey'),
                      privacyMode ? PRIVACY_MASK : shortPubkey(hop.pub_key),
                      { copyToClipboard: true, variant: 'mono', width: '100%' }
                    ],
                    [
                      t('lightning.node.txDetail.chanId'),
                      hop.chan_id,
                      { copyToClipboard: true, variant: 'mono' }
                    ],
                    [
                      t('lightning.node.txDetail.chanCapacity'),
                      hop.chan_capacity
                    ],
                    [
                      t('lightning.node.txDetail.amtForwardSat'),
                      privacyMode ? PRIVACY_MASK : hop.amt_to_forward
                    ],
                    [
                      t('lightning.node.txDetail.amtForwardMsat'),
                      privacyMode ? PRIVACY_MASK : hop.amt_to_forward_msat
                    ],
                    [
                      t('lightning.node.txDetail.feeSat'),
                      privacyMode ? PRIVACY_MASK : hop.fee
                    ],
                    [
                      t('lightning.node.txDetail.feeMsat'),
                      privacyMode
                        ? PRIVACY_MASK
                        : hopFeeMsatWithPct(
                            hop.fee_msat,
                            hop.amt_to_forward_msat
                          )
                    ]
                  ]}
                />
              </View>
            )
          })}
        </SSVStack>
      )}
    </SSVStack>
  )
}

function paymentHops(payment: LndPayment): Hop[] {
  return payment.htlcs?.[0]?.route?.hops ?? []
}

function InvoiceDetail({
  invoice,
  privacyMode
}: {
  invoice: LndInvoice
  privacyMode: boolean
}) {
  const settleDate = Number(invoice.settle_date)

  return (
    <SSVStack gap="md">
      <SectionHeader label={t('lightning.node.txDetail.section.invoice')} />
      <SSDetailsList
        columns={2}
        gap={16}
        variant="mono"
        copyToClipboard
        items={[
          [
            t('lightning.node.txDetail.rHash'),
            privacyMode ? PRIVACY_MASK : invoice.r_hash,
            { width: '100%' }
          ],
          [
            t('lightning.node.txDetail.paymentAddr'),
            privacyMode ? PRIVACY_MASK : invoice.payment_addr,
            { width: '100%' }
          ],
          [
            t('lightning.node.txDetail.paymentRequest'),
            privacyMode ? PRIVACY_MASK : invoice.payment_request,
            { width: '100%' }
          ]
        ]}
      />
      <SSDetailsList
        columns={2}
        gap={16}
        items={[
          [
            t('lightning.node.txDetail.valueSat'),
            privacyMode ? PRIVACY_MASK : invoice.value
          ],
          [
            t('lightning.node.txDetail.valueMsat'),
            privacyMode ? PRIVACY_MASK : invoice.value_msat
          ],
          [
            t('lightning.node.txDetail.amtPaidSat'),
            privacyMode ? PRIVACY_MASK : invoice.amt_paid_sat
          ],
          [
            t('lightning.node.txDetail.amtPaidMsat'),
            privacyMode ? PRIVACY_MASK : invoice.amt_paid_msat
          ],
          [
            t('lightning.node.txDetail.created'),
            formatUnixTimestamp(Number(invoice.creation_date))
          ],
          settleDate && settleDate !== 0
            ? [
                t('lightning.node.txDetail.settled'),
                formatUnixTimestamp(settleDate)
              ]
            : [t('lightning.node.txDetail.settled'), '—'],
          [t('lightning.node.txDetail.expiry'), invoice.expiry],
          [t('lightning.node.txDetail.cltvExpiry'), invoice.cltv_expiry],
          [t('lightning.node.txDetail.addIndex'), invoice.add_index]
        ]}
      />
    </SSVStack>
  )
}

function OnchainDetail({
  onchain,
  privacyMode
}: {
  onchain: LndOnchainTransaction
  privacyMode: boolean
}) {
  const destAddresses = onchain.dest_addresses ?? []
  const hashItems: [string, string][] = [
    [
      t('lightning.node.txDetail.txHash'),
      privacyMode ? PRIVACY_MASK : onchain.tx_hash
    ]
  ]
  if (onchain.block_hash) {
    hashItems.push([
      t('lightning.node.txDetail.blockHash'),
      privacyMode ? PRIVACY_MASK : onchain.block_hash
    ])
  }
  const metaItems: [string, string][] = [
    [
      t('lightning.node.txDetail.confirmations'),
      String(onchain.num_confirmations)
    ],
    [t('lightning.node.txDetail.blockHeight'), String(onchain.block_height)],
    [
      t('lightning.node.txDetail.totalFees'),
      privacyMode ? PRIVACY_MASK : onchain.total_fees
    ]
  ]
  if (onchain.label) {
    metaItems.push([t('lightning.node.txDetail.txHash'), onchain.label])
  }

  return (
    <SSVStack gap="md">
      <SectionHeader label={t('lightning.node.txDetail.section.transaction')} />
      <SSDetailsList
        columns={1}
        gap={16}
        variant="mono"
        copyToClipboard
        items={hashItems}
      />
      <SSDetailsList columns={2} gap={16} items={metaItems} />
      {destAddresses.length > 0 && (
        <SSVStack gap="xs">
          <SSText size="xs" color="muted" uppercase>
            {t('lightning.node.txDetail.destAddresses')}
          </SSText>
          {destAddresses.map((addr, i) => (
            <SSDetailsList
              key={i}
              columns={1}
              gap={4}
              variant="mono"
              copyToClipboard
              items={[[String(i + 1), addr]]}
            />
          ))}
        </SSVStack>
      )}
      {onchain.raw_tx_hex && (
        <SSDetailsList
          columns={1}
          gap={8}
          variant="mono"
          copyToClipboard
          items={[
            [
              t('lightning.node.txDetail.rawTx'),
              privacyMode ? PRIVACY_MASK : onchain.raw_tx_hex
            ]
          ]}
        />
      )}
    </SSVStack>
  )
}

function heroAmountColor(tx: { type: string; status: string }): string {
  if (tx.type === 'lightning_send' && tx.status.toLowerCase() === 'succeeded') {
    return Colors.mainRed
  }
  if (tx.type === 'lightning_receive' && tx.status === 'settled') {
    return Colors.mainGreen
  }
  return Colors.white
}

export default function LndTransactionDetailPage() {
  const { txId, txType } = useLocalSearchParams<{
    txId: string
    txType: string
  }>()

  const { data: dashboardData } = useLndNodeDashboard(true)

  const tx = dashboardData?.transactions.find((t) => t.id === txId)
  const rawInvoice =
    txType === 'lightning_receive' && txId
      ? (dashboardData?.rawInvoices[txId] ?? null)
      : null
  const rawPayment =
    txType === 'lightning_send' && txId
      ? (dashboardData?.rawPayments[txId] ?? null)
      : null
  const rawOnchain =
    txType === 'onchain' && txId
      ? (dashboardData?.rawOnchainTxs[txId] ?? null)
      : null

  const typeLabel =
    txType === 'lightning_send'
      ? t('lightning.node.txDetail.type.send')
      : txType === 'lightning_receive'
        ? t('lightning.node.txDetail.type.receive')
        : t('lightning.node.txDetail.type.onchain')

  const privacyMode = useSettingsStore(useShallow((s) => s.privacyMode))
  const { makeRequest } = useLND()
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((s) => [s.btcPrice, s.fiatCurrency])
  )
  const mempoolUrl = useBlockchainStore((s) => s.configsMempool['bitcoin'])

  const { data: historicalBtcPrice } = useQuery({
    enabled: !!tx?.timestamp,
    queryFn: async () => {
      const oracle = new MempoolOracle(mempoolUrl)
      const prices = await oracle.getFullPriceAt(fiatCurrency, tx!.timestamp)
      return prices[fiatCurrency] ?? 0
    },
    queryKey: ['btcHistoricalPrice', fiatCurrency, tx?.timestamp],
    staleTime: Infinity
  })

  const hopPubkeys = rawPayment
    ? [
        ...new Set(
          paymentHops(rawPayment)
            .map((h) => h.pub_key)
            .filter(Boolean)
        )
      ]
    : []

  const { data: nodeInfoMap = {} } = useQuery({
    enabled: hopPubkeys.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        hopPubkeys.map(async (pk) => {
          try {
            const res = await makeRequest<{ node: LNDGraphNodeInfo }>(
              `/v1/graph/node/${pk}`,
              { disconnectOnError: false }
            )
            return [pk, res.node] as const
          } catch {
            return [pk, null] as const
          }
        })
      )
      return Object.fromEntries(entries) as Record<
        string,
        LNDGraphNodeInfo | null
      >
    },
    queryKey: ['lnd', 'nodeInfo', ...hopPubkeys],
    staleTime: 5 * 60 * 1000
  })

  const satsAbs = tx ? Math.abs(tx.amount) : 0
  const currentFiat = btcPrice > 0 ? formatFiatPrice(satsAbs, btcPrice) : null
  const historicalFiat =
    historicalBtcPrice && historicalBtcPrice > 0
      ? formatFiatPrice(satsAbs, historicalBtcPrice)
      : null

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <SSHStack
              gap="none"
              style={{
                alignItems: 'center',
                marginLeft: -HEADER_CHROME_EDGE_NUDGE
              }}
            >
              <SSIconButton
                style={HEADER_CHROME_HIT_BOX}
                onPress={() => router.back()}
              >
                <SSIconBackArrow
                  height={HEADER_CHROME_ICON_SIZE}
                  stroke="#828282"
                  width={HEADER_CHROME_ICON_SIZE}
                />
              </SSIconButton>
            </SSHStack>
          ),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {typeLabel}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {!tx && !rawInvoice && !rawPayment && !rawOnchain ? (
            <SSVStack itemsCenter style={styles.notFound}>
              <SSText color="muted">
                {t('lightning.node.txDetail.notFound')}
              </SSText>
            </SSVStack>
          ) : (
            <SSVStack gap="xl">
              {tx && (
                <SSVStack gap="none" style={styles.hero}>
                  <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
                    <StatusBadge status={tx.status} />
                    <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
                      <SSText color="muted" size="xs" style={{ opacity: 0.55 }}>
                        {formatUnixTimestamp(tx.timestamp)}
                      </SSText>
                      <SSText color="muted" size="xs">
                        {formatLightningTxTimeAgo(tx.timestamp, Date.now())}
                      </SSText>
                    </SSVStack>
                  </SSHStack>

                  <SSVStack gap="none" style={{ marginTop: 16 }}>
                    <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                      <SSText
                        size="4xl"
                        weight="ultralight"
                        style={{
                          color: heroAmountColor(tx),
                          letterSpacing: -1,
                          marginLeft: tx.amount < 0 ? -5 : 0
                        }}
                      >
                        {privacyMode
                          ? PRIVACY_MASK
                          : `${tx.amount > 0 ? '+' : ''}${formatNumber(tx.amount, 0, false, ',')}`}
                      </SSText>
                      <SSText size="sm" style={{ color: Colors.gray[500] }}>
                        {t('bitcoin.sats').toLowerCase()}
                      </SSText>
                    </SSHStack>
                    {!privacyMode && (currentFiat || historicalFiat) && (
                      <SSHStack gap="xs">
                        {currentFiat && (
                          <SSText color="muted" size="sm">
                            {currentFiat}
                          </SSText>
                        )}
                        {historicalFiat && (
                          <SSText style={{ color: Colors.gray[500] }} size="sm">
                            ({historicalFiat})
                          </SSText>
                        )}
                        <SSText style={{ color: Colors.gray[700] }} size="sm">
                          {fiatCurrency}
                        </SSText>
                      </SSHStack>
                    )}
                  </SSVStack>

                  {tx.description ? (
                    <SSText size="sm" color="muted" style={{ marginTop: 10 }}>
                      {privacyMode ? PRIVACY_MASK : tx.description}
                    </SSText>
                  ) : null}
                </SSVStack>
              )}

              {rawPayment && paymentHops(rawPayment).length > 0 && (
                <HopDiagram
                  hops={paymentHops(rawPayment)}
                  nodeInfoMap={nodeInfoMap}
                  privacyMode={privacyMode}
                />
              )}

              {rawPayment && (
                <PaymentDetail
                  nodeInfoMap={nodeInfoMap}
                  payment={rawPayment}
                  privacyMode={privacyMode}
                />
              )}

              {rawInvoice && (
                <InvoiceDetail invoice={rawInvoice} privacyMode={privacyMode} />
              )}

              {rawOnchain && (
                <OnchainDetail onchain={rawOnchain} privacyMode={privacyMode} />
              )}

              {tx && !rawPayment && !rawInvoice && !rawOnchain && (
                <SSVStack gap="md">
                  <SectionHeader
                    label={t('lightning.node.txDetail.section.transaction')}
                  />
                  <SSDetailsList
                    columns={2}
                    gap={16}
                    items={[
                      [
                        t('lightning.node.txDetail.txHash'),
                        privacyMode ? PRIVACY_MASK : tx.hash,
                        {
                          copyToClipboard: true,
                          variant: 'mono',
                          width: '100%'
                        }
                      ],
                      [
                        t('lightning.node.txDetail.created'),
                        formatUnixTimestamp(tx.timestamp)
                      ],
                      tx.fee !== undefined
                        ? [
                            t('lightning.node.txDetail.feeSat'),
                            privacyMode ? PRIVACY_MASK : String(tx.fee)
                          ]
                        : ['', '']
                    ]}
                  />
                </SSVStack>
              )}
            </SSVStack>
          )}
        </ScrollView>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 8
  },
  hopArrow: {
    color: Colors.gray[600],
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center'
  },
  hopCard: {
    gap: 10,
    paddingVertical: 10
  },
  hopCardDot: {
    borderRadius: 3,
    borderWidth: 1,
    flexShrink: 0,
    height: 8,
    width: 8
  },
  hopCardHeader: {
    alignItems: 'flex-start'
  },
  hopDiagram: {
    paddingLeft: 4
  },
  hopDot: {
    borderColor: Colors.gray[600],
    borderRadius: 5,
    borderWidth: 1.5,
    height: 10,
    width: 10
  },
  hopDotHighlight: {
    backgroundColor: Colors.white,
    borderColor: Colors.white
  },
  hopEdgeChanId: {
    fontVariant: ['tabular-nums']
  },
  hopEdgeLine: {
    backgroundColor: Colors.gray[700],
    flex: 1,
    width: 1.5
  },
  hopEdgeLineCol: {
    alignItems: 'center',
    paddingHorizontal: 4,
    width: 20
  },
  hopEdgeMeta: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    paddingLeft: 5
  },
  hopEdgeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    minHeight: 36,
    paddingVertical: 4
  },
  hopIndexBadge: {
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[700],
    borderRadius: 2,
    borderWidth: 1,
    flexShrink: 0,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  hopIndexBadgeText: {
    color: Colors.gray[400],
    fontSize: 10
  },
  hopLabel: {
    flex: 1,
    paddingLeft: 10
  },
  hopLabelMono: {
    fontVariant: ['tabular-nums']
  },
  hopNodeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: 5
  },
  notFound: {
    paddingTop: 60
  },
  scrollContent: {
    paddingBottom: 60,
    paddingTop: 16
  },
  sectionDivider: {
    backgroundColor: Colors.gray[800],
    flex: 1,
    height: 1,
    marginLeft: 8
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  statusBadge: {
    borderRadius: 2,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  statusBadgeNegative: {
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[600]
  },
  statusBadgeNeutral: {
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[700]
  },
  statusBadgePositive: {
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[600]
  },
  statusTextNegative: {
    color: Colors.gray[400]
  },
  statusTextNeutral: {
    color: Colors.gray[400]
  },
  statusTextPositive: {
    color: Colors.gray[200]
  }
})
