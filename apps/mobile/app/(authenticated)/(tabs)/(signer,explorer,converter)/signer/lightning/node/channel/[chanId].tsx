import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSLightningChannelLiquidityBar from '@/components/SSLightningChannelLiquidityBar'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE
} from '@/constants/headerChrome'
import { useLND } from '@/hooks/useLND'
import { useLndChannelDetailActions } from '@/hooks/useLndChannelDetailActions'
import { useLndChannelHistoryQuery } from '@/hooks/useLndChannelHistoryQuery'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout } from '@/styles'
import type { ChannelHistoryRow } from '@/types/lndChannelHistory'
import { type LNDChannel } from '@/types/models/LND'
import { formatNumber } from '@/utils/format'
import {
  findChannelByChanId,
  formatLndChannelDetailValue,
  getLndChannelPeerAlias,
  getLndChannelRemotePubkey,
  readLndChannelSatsField,
  readLndChannelStringField
} from '@/utils/lndChannelDetail'
import { getLndErrorMessage, isLndPermissionError } from '@/utils/lndHttpError'

import { getLndFundingTxMempoolUrl } from '../../../../../../../../utils/lndGetInfoChains'

const PRIVACY_MASK = '••••'

type DetailRow = {
  labelSuffix: string
  mono: boolean
  /** When true, value is hidden in privacy mode. */
  sensitive: boolean
  value: (channel: LNDChannel) => string
}

type DetailItem =
  | { kind: 'pair'; left: DetailRow; right: DetailRow }
  | { kind: 'single'; row: DetailRow }

/** Consecutive row pairs: labels on one line, values on the next. */
const DETAIL_CONSECUTIVE_PAIRS: readonly (readonly [string, string])[] = [
  ['peerAlias', 'initiator'],
  ['active', 'private'],
  ['localBalance', 'remoteBalance'],
  ['commitFee', 'commitWeight'],
  ['feePerKw', 'csvDelay'],
  ['lifetime', 'uptime'],
  ['localChanReserveSat', 'remoteChanReserveSat'],
  ['totalSatoshisSent', 'totalSatoshisReceived']
]

function buildDetailItems(rows: DetailRow[]): DetailItem[] {
  const items: DetailItem[] = []
  let i = 0
  while (i < rows.length) {
    const row = rows[i]
    const next = rows[i + 1]
    const isPair = DETAIL_CONSECUTIVE_PAIRS.some(
      ([a, b]) => row.labelSuffix === a && next?.labelSuffix === b
    )
    if (isPair && next) {
      items.push({ kind: 'pair', left: row, right: next })
      i += 2
    } else {
      items.push({ kind: 'single', row })
      i += 1
    }
  }
  return items
}

function buildRows(): DetailRow[] {
  return [
    {
      labelSuffix: 'peerAlias',
      mono: false,
      sensitive: true,
      value: (c) => getLndChannelPeerAlias(c) || '—'
    },
    {
      labelSuffix: 'initiator',
      mono: false,
      sensitive: false,
      value: (c) => String(c.initiator)
    },
    {
      labelSuffix: 'active',
      mono: false,
      sensitive: false,
      value: (c) => String(c.active)
    },
    {
      labelSuffix: 'private',
      mono: false,
      sensitive: false,
      value: (c) => String(c.private)
    },
    {
      labelSuffix: 'remotePubkey',
      mono: true,
      sensitive: true,
      value: (c) => getLndChannelRemotePubkey(c) || '—'
    },
    {
      labelSuffix: 'channelPoint',
      mono: true,
      sensitive: true,
      value: (c) =>
        readLndChannelStringField(c, ['channel_point', 'channelPoint']) || '—'
    },
    {
      labelSuffix: 'chanId',
      mono: true,
      sensitive: true,
      value: (c) => readLndChannelStringField(c, ['chan_id', 'chanId']) || '—'
    },
    {
      labelSuffix: 'capacity',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(readLndChannelSatsField(c, ['capacity']))
    },
    {
      labelSuffix: 'localBalance',
      mono: false,
      sensitive: true,
      value: (c) =>
        formatNumber(
          readLndChannelSatsField(c, ['local_balance', 'localBalance'])
        )
    },
    {
      labelSuffix: 'remoteBalance',
      mono: false,
      sensitive: true,
      value: (c) =>
        formatNumber(
          readLndChannelSatsField(c, ['remote_balance', 'remoteBalance'])
        )
    },
    {
      labelSuffix: 'unsettledBalance',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.unsettled_balance)
    },
    {
      labelSuffix: 'commitFee',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.commit_fee)
    },
    {
      labelSuffix: 'commitWeight',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.commit_weight)
    },
    {
      labelSuffix: 'feePerKw',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.fee_per_kw)
    },
    {
      labelSuffix: 'csvDelay',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.csv_delay)
    },
    {
      labelSuffix: 'chanStatusFlags',
      mono: true,
      sensitive: true,
      value: (c) => c.chan_status_flags || '—'
    },
    {
      labelSuffix: 'commitmentType',
      mono: true,
      sensitive: true,
      value: (c) => c.commitment_type || '—'
    },
    {
      labelSuffix: 'staticRemoteKey',
      mono: false,
      sensitive: false,
      value: (c) => String(c.static_remote_key)
    },
    {
      labelSuffix: 'localChanReserveSat',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.local_chan_reserve_sat)
    },
    {
      labelSuffix: 'remoteChanReserveSat',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.remote_chan_reserve_sat)
    },
    {
      labelSuffix: 'totalSatoshisSent',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.total_satoshis_sent)
    },
    {
      labelSuffix: 'totalSatoshisReceived',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.total_satoshis_received)
    },
    {
      labelSuffix: 'numUpdates',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.num_updates)
    },
    {
      labelSuffix: 'lifetime',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.lifetime)
    },
    {
      labelSuffix: 'uptime',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.uptime)
    },
    {
      labelSuffix: 'closeAddress',
      mono: true,
      sensitive: true,
      value: (c) => c.close_address?.trim() || '—'
    },
    {
      labelSuffix: 'pushAmountSat',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.push_amount_sat)
    },
    {
      labelSuffix: 'thawHeight',
      mono: false,
      sensitive: true,
      value: (c) => formatNumber(c.thaw_height)
    },
    {
      labelSuffix: 'localConstraintsJson',
      mono: true,
      sensitive: true,
      value: (c) => formatLndChannelDetailValue(c.local_constraints)
    },
    {
      labelSuffix: 'remoteConstraintsJson',
      mono: true,
      sensitive: true,
      value: (c) => formatLndChannelDetailValue(c.remote_constraints)
    },
    {
      labelSuffix: 'pendingHtlcs',
      mono: true,
      sensitive: true,
      value: (c) => formatLndChannelDetailValue(c.pending_htlcs)
    }
  ]
}

const DETAIL_ROWS = buildRows()
const DETAIL_ITEMS = buildDetailItems(DETAIL_ROWS)

export default function LightningChannelDetailPage() {
  const router = useRouter()
  const params = useLocalSearchParams<{ chanId: string }>()
  const {
    channels,
    closeChannel,
    exportChannelBackupSingle,
    getChannels,
    isConnecting,
    makeRequest,
    nodeInfo
  } = useLND()
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const rawChanId = params.chanId
  const chanIdParam = Array.isArray(rawChanId) ? rawChanId[0] : rawChanId
  const chanIdDecoded =
    typeof chanIdParam === 'string' && chanIdParam.length > 0
      ? decodeURIComponent(chanIdParam)
      : ''
  const channel = findChannelByChanId(channels, chanIdDecoded)

  const nodeTotalCapacity = (channels ?? []).reduce((sum, ch) => {
    if (!ch || typeof ch !== 'object') {
      return sum
    }
    return sum + readLndChannelSatsField(ch, ['capacity'])
  }, 0)

  const historyQuery = useLndChannelHistoryQuery(
    makeRequest,
    chanIdDecoded,
    Boolean(channel)
  )
  const historyRows: ChannelHistoryRow[] = historyQuery.data ?? []
  const historyLoading = historyQuery.fetchStatus === 'fetching'
  const historyError =
    historyQuery.error !== null && historyQuery.error !== undefined
      ? getLndErrorMessage(historyQuery.error)
      : null

  function handleBack() {
    router.back()
  }

  const screenTitle = channel
    ? getLndChannelPeerAlias(channel) ||
      readLndChannelStringField(channel, ['chan_id', 'chanId'])
    : t('lightning.channelDetail.chanId')

  function formatHistoryTime(sec: number): string {
    if (!Number.isFinite(sec) || sec <= 0) {
      return '—'
    }
    return new Date(sec * 1000).toLocaleString('en-US', {
      day: 'numeric',
      hour: 'numeric',
      hour12: true,
      minute: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const channelPointStr = channel
    ? readLndChannelStringField(channel, ['channel_point', 'channelPoint'])
    : ''
  const fundingTxid = channel
    ? readLndChannelStringField(channel, [
        'channel_point',
        'channelPoint'
      ]).split(':')[0] || ''
    : ''

  const {
    actionBusy,
    copyChannelPoint,
    exportChannelBackup,
    openFundingExplorer,
    requestCloseCooperative,
    requestForceClose
  } = useLndChannelDetailActions({
    chains: nodeInfo?.chains,
    chanIdDecoded,
    channel,
    channelPointStr,
    closeChannel,
    exportChannelBackupSingle,
    fundingTxid,
    getChannels,
    onCloseSuccessNavigateBack: () => {
      router.back()
    }
  })

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <SSIconButton
              style={[
                HEADER_CHROME_HIT_BOX,
                { marginLeft: -HEADER_CHROME_EDGE_NUDGE }
              ]}
              onPress={handleBack}
            >
              <SSIconBackArrow
                height={HEADER_CHROME_ICON_SIZE}
                stroke={Colors.gray[200]}
                width={HEADER_CHROME_ICON_SIZE}
              />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase numberOfLines={1} style={{ letterSpacing: 0.5 }}>
              {screenTitle}
            </SSText>
          )
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        {!channel ? (
          <SSVStack gap="md" style={styles.centered}>
            <SSText color="muted" center>
              {t('lightning.channelDetail.notFound')}
            </SSText>
            <Pressable onPress={handleBack}>
              <SSText center color="white" style={styles.link}>
                {t('common.goBack')}
              </SSText>
            </Pressable>
          </SSVStack>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <SSVStack gap="none">
              <SSVStack gap="none" style={styles.liquidityBarWrap}>
                <SSLightningChannelLiquidityBar
                  channelCapacity={readLndChannelSatsField(channel, [
                    'capacity'
                  ])}
                  localSats={readLndChannelSatsField(channel, [
                    'local_balance',
                    'localBalance'
                  ])}
                  nodeTotalCapacity={nodeTotalCapacity}
                  privacyMode={privacyMode}
                  remoteSats={readLndChannelSatsField(channel, [
                    'remote_balance',
                    'remoteBalance'
                  ])}
                />
              </SSVStack>

              {DETAIL_ITEMS.map((item) => {
                const showChannelActionsAfterRow =
                  item.kind === 'pair' &&
                  item.left.labelSuffix === 'active' &&
                  item.right.labelSuffix === 'private'

                const channelActions = showChannelActionsAfterRow ? (
                  <View style={styles.channelActions}>
                    <SSVStack gap="md">
                      <SSButton
                        disabled={
                          !channelPointStr ||
                          actionBusy !== null ||
                          isConnecting
                        }
                        label={t('lightning.channelDetail.copyChannelPoint')}
                        onPress={() => {
                          void copyChannelPoint()
                        }}
                        variant="default"
                      />
                      <SSButton
                        disabled={
                          !fundingTxid ||
                          actionBusy !== null ||
                          isConnecting ||
                          getLndFundingTxMempoolUrl(
                            fundingTxid,
                            nodeInfo?.chains
                          ) === null
                        }
                        label={t('lightning.channelDetail.openFundingTx')}
                        onPress={() => {
                          void openFundingExplorer()
                        }}
                        variant="default"
                      />
                      <SSButton
                        disabled={
                          !channel ||
                          !channelPointStr ||
                          actionBusy !== null ||
                          isConnecting
                        }
                        label={t('lightning.channelDetail.exportScbButton')}
                        loading={actionBusy === 'export'}
                        onPress={() => {
                          void exportChannelBackup()
                        }}
                        variant="default"
                      />
                      <SSButton
                        disabled={
                          !channelPointStr ||
                          actionBusy !== null ||
                          isConnecting
                        }
                        label={t(
                          'lightning.channelDetail.closeCooperativeButton'
                        )}
                        loading={actionBusy === 'close'}
                        onPress={requestCloseCooperative}
                        variant="default"
                      />
                      <SSButton
                        disabled={
                          !channelPointStr ||
                          actionBusy !== null ||
                          isConnecting
                        }
                        label={t('lightning.channelDetail.forceCloseButton')}
                        loading={actionBusy === 'force'}
                        onPress={requestForceClose}
                        variant="danger"
                      />
                    </SSVStack>
                  </View>
                ) : null

                if (item.kind === 'pair') {
                  const key = `${item.left.labelSuffix}-${item.right.labelSuffix}`
                  return (
                    <Fragment key={key}>
                      <View style={styles.row}>
                        <SSHStack
                          gap="md"
                          justifyBetween
                          style={styles.pairLabels}
                        >
                          <View style={styles.pairHalf}>
                            <SSText color="muted" numberOfLines={2} size="xs">
                              {t(
                                `lightning.channelDetail.${item.left.labelSuffix}`
                              )}
                            </SSText>
                          </View>
                          <View style={[styles.pairHalf, styles.pairHalfEnd]}>
                            <SSText
                              color="muted"
                              numberOfLines={2}
                              size="xs"
                              style={styles.pairLabelEnd}
                            >
                              {t(
                                `lightning.channelDetail.${item.right.labelSuffix}`
                              )}
                            </SSText>
                          </View>
                        </SSHStack>
                        <SSHStack gap="md" justifyBetween>
                          <View style={styles.pairHalf}>
                            <SSText
                              color="white"
                              ellipsizeMode="tail"
                              numberOfLines={3}
                              size="sm"
                              style={
                                item.left.mono
                                  ? styles.valueMonoWrap
                                  : styles.valueWrap
                              }
                              type={item.left.mono ? 'mono' : 'sans-serif'}
                            >
                              {privacyMode && item.left.sensitive
                                ? PRIVACY_MASK
                                : item.left.value(channel)}
                            </SSText>
                          </View>
                          <View style={[styles.pairHalf, styles.pairHalfEnd]}>
                            <SSText
                              color="white"
                              ellipsizeMode="tail"
                              numberOfLines={3}
                              size="sm"
                              style={[
                                item.right.mono
                                  ? styles.valueMonoWrap
                                  : styles.valueWrap,
                                styles.pairValueEnd
                              ]}
                              type={item.right.mono ? 'mono' : 'sans-serif'}
                            >
                              {privacyMode && item.right.sensitive
                                ? PRIVACY_MASK
                                : item.right.value(channel)}
                            </SSText>
                          </View>
                        </SSHStack>
                      </View>
                      {channelActions}
                    </Fragment>
                  )
                }

                const { row } = item
                const raw = row.value(channel)
                const display =
                  privacyMode && row.sensitive ? PRIVACY_MASK : raw
                const labelKey = `lightning.channelDetail.${row.labelSuffix}`
                return (
                  <Fragment key={row.labelSuffix}>
                    <View style={styles.row}>
                      <SSText color="muted" size="xs" style={styles.label}>
                        {t(labelKey)}
                      </SSText>
                      <SSText
                        color="white"
                        size="sm"
                        style={
                          row.mono ? styles.valueMonoWrap : styles.valueWrap
                        }
                        type={row.mono ? 'mono' : 'sans-serif'}
                      >
                        {display}
                      </SSText>
                    </View>
                    {channelActions}
                  </Fragment>
                )
              })}

              <View style={styles.historySection}>
                <SSText color="muted" size="sm" style={styles.historyTitle}>
                  {t('lightning.channelDetail.historyTitle')}
                </SSText>
                {historyLoading ? (
                  <SSText color="muted" size="xs" style={styles.historyPad}>
                    {t('lightning.channelDetail.historyLoading')}
                  </SSText>
                ) : historyError ? (
                  <SSText color="muted" size="xs" style={styles.historyPad}>
                    {isLndPermissionError(historyError)
                      ? `${t('lightning.channelDetail.historyError')}: ${t('lightning.nodeSettings.permissionDenied')}`
                      : `${t('lightning.channelDetail.historyError')}: ${historyError}`}
                  </SSText>
                ) : historyRows.length === 0 ? (
                  <SSText color="muted" size="xs" style={styles.historyPad}>
                    {t('lightning.channelDetail.historyEmpty')}
                  </SSText>
                ) : (
                  historyRows.map((row) => {
                    const typeLabel =
                      row.source === 'forward'
                        ? t('lightning.channelDetail.historyForward')
                        : t('lightning.channelDetail.historyPaymentOut')
                    const typeColor =
                      row.source === 'forward' ? Colors.white : Colors.mainRed
                    return (
                      <View key={row.id} style={styles.historyRow}>
                        <View style={styles.historyRowTop}>
                          {privacyMode ? (
                            <SSText color="white" size="md" weight="light">
                              {PRIVACY_MASK}
                            </SSText>
                          ) : (
                            <SSStyledSatText
                              amount={row.primarySats}
                              decimals={0}
                              noColor={false}
                              textSize="md"
                              type="send"
                              weight="light"
                            />
                          )}
                          <SSText color="muted" size="xs">
                            {formatHistoryTime(row.timestampSec)}
                          </SSText>
                        </View>
                        <SSHStack
                          gap="sm"
                          justifyBetween
                          style={styles.historyMetaRow}
                        >
                          <SSText style={{ color: typeColor }} size="xs">
                            {typeLabel}
                          </SSText>
                          <SSText color="muted" size="xxs">
                            {privacyMode
                              ? PRIVACY_MASK
                              : `${t('lightning.channelDetail.historyFee')}: ${formatNumber(row.feeSat)}`}
                          </SSText>
                        </SSHStack>
                        {row.extraLine && !privacyMode ? (
                          <SSText
                            color="muted"
                            ellipsizeMode="middle"
                            numberOfLines={row.source === 'payment' ? 1 : 3}
                            size="xxs"
                            type="mono"
                          >
                            {row.extraLine}
                          </SSText>
                        ) : null}
                      </View>
                    )
                  })
                )}
              </View>
            </SSVStack>
          </ScrollView>
        )}
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: Layout.mainContainer.paddingBottom,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: 0
  },
  channelActions: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 8
  },
  historyMetaRow: {
    alignItems: 'baseline',
    marginTop: 2
  },
  historyPad: {
    paddingTop: 8
  },
  historyRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    gap: 4,
    paddingBottom: 12,
    paddingTop: 10
  },
  historyRowTop: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  historySection: {
    marginTop: 20,
    paddingTop: 8
  },
  historyTitle: {
    marginBottom: 8
  },
  label: {
    marginBottom: 4
  },
  link: {
    textDecorationLine: 'underline'
  },
  liquidityBarWrap: {
    marginBottom: 12
  },
  mainLayout: {
    flex: 1,
    paddingTop: 10
  },
  pairHalf: {
    flex: 1,
    minWidth: 0
  },
  pairHalfEnd: {
    alignItems: 'flex-end'
  },
  pairLabelEnd: {
    textAlign: 'right'
  },
  pairLabels: {
    marginBottom: 4
  },
  pairValueEnd: {
    textAlign: 'right'
  },
  row: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 12,
    paddingTop: 4
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Layout.mainContainer.paddingBottom
  },
  valueMonoWrap: {
    lineHeight: 18
  },
  valueWrap: {
    lineHeight: 20
  }
})
