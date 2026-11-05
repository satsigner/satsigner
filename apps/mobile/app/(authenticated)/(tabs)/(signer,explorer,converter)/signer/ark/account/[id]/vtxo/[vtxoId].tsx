import { router, Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSArkMovementCard from '@/components/SSArkMovementCard'
import SSArkVtxoLineage from '@/components/SSArkVtxoLineage'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSDetailRow from '@/components/SSDetailRow'
import SSText from '@/components/SSText'
import { useArkServerInfo } from '@/hooks/useArkBoard'
import { useArkExitFeeEstimate } from '@/hooks/useArkExitFeeEstimate'
import { useArkFeeEstimate } from '@/hooks/useArkFeeEstimate'
import { useArkMovements } from '@/hooks/useArkMovements'
import { useArkRefresh } from '@/hooks/useArkRefresh'
import { useArkTipHeight } from '@/hooks/useArkTipHeight'
import { type ArkVtxoDecoded, useArkVtxoDecode } from '@/hooks/useArkVtxoDecode'
import { useArkVtxos } from '@/hooks/useArkVtxos'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Typography } from '@/styles'
import type { ArkMovement, ArkVtxo } from '@/types/models/Ark'
import {
  type ArkVtxoExpiry,
  type ArkVtxoExpiryUrgency,
  buildArkVtxoLineage,
  findArkVtxoMovements,
  getArkVtxoEta,
  getArkVtxoExpiry,
  getArkVtxoPolicyKey,
  getArkVtxoPolicyPaymentHash,
  isArkVtxoExitUneconomical
} from '@/utils/arkVtxoDetail'
import { setClipboard } from '@/utils/clipboard'
import { formatFiatPrice, formatNumber } from '@/utils/format'

const EXPIRY_COLORS: Record<ArkVtxoExpiryUrgency, string> = {
  expired: Colors.mainRed,
  ok: Colors.gray[100],
  soon: Colors.warning
}
const PERCENT = 100

type ExpirySectionProps = {
  expiry: ArkVtxoExpiry
  expiryHeight: number
}

function ExpirySection({ expiry, expiryHeight }: ExpirySectionProps) {
  const color = EXPIRY_COLORS[expiry.urgency]
  const eta = getArkVtxoEta(expiry.blocksLeft)
  const headline =
    expiry.urgency === 'expired'
      ? t('ark.vtxo.detail.expiry.expired')
      : t('ark.vtxo.detail.expiry.left', {
          blocks: formatNumber(expiry.blocksLeft),
          eta: t(`ark.vtxo.detail.eta.${eta.unit}`, { count: eta.count })
        })

  return (
    <SSVStack gap="xs" style={styles.section}>
      <SSHStack justifyBetween>
        <SSText size="sm" style={{ color }}>
          {headline}
        </SSText>
        <SSText size="xs" color="muted">
          {t('ark.vtxo.detail.expiry.block', {
            height: formatNumber(expiryHeight)
          })}
        </SSText>
      </SSHStack>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${expiry.elapsedRatio * PERCENT}%`
            }
          ]}
        />
      </View>
      {expiry.urgency !== 'ok' && (
        <SSText size="xs" style={{ color }}>
          {t(`ark.vtxo.detail.expiry.warning.${expiry.urgency}`)}
        </SSText>
      )}
    </SSVStack>
  )
}

type RefreshActionProps = {
  accountId: string
  vtxoId: string
}

function RefreshAction({ accountId, vtxoId }: RefreshActionProps) {
  const refreshMutation = useArkRefresh(accountId)
  const feeQuery = useArkFeeEstimate({
    accountId,
    request: { kind: 'refresh', vtxoIds: [vtxoId] }
  })

  function handleRefresh() {
    refreshMutation.mutate([vtxoId], {
      onError: (error) => {
        toast.error(error.message || t('ark.refresh.error'))
      },
      onSuccess: () => {
        toast.success(t('ark.refresh.success'))
        router.back()
      }
    })
  }

  return (
    <SSVStack gap="xs" style={styles.section}>
      {feeQuery.data && (
        <SSText size="xs" color="muted">
          {t('ark.refresh.feeLabel', {
            amount: formatNumber(feeQuery.data.feeSats),
            unit: t('bitcoin.sats')
          })}
        </SSText>
      )}
      <SSButton
        variant="secondary"
        label={t('ark.vtxo.detail.refresh')}
        loading={refreshMutation.isPending}
        disabled={refreshMutation.isPending}
        onPress={handleRefresh}
      />
    </SSVStack>
  )
}

type SectionHeaderProps = {
  title: string
  subtitle?: string
}

function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <SSVStack gap="xxs">
      <SSText uppercase size="sm">
        {title}
      </SSText>
      {subtitle && (
        <SSText size="xs" color="muted">
          {subtitle}
        </SSText>
      )}
    </SSVStack>
  )
}

type ExitSectionProps = {
  amountSats: number
  decoded: ArkVtxoDecoded
  estimatedFeeSats?: number
}

function ExitSection({
  amountSats,
  decoded,
  estimatedFeeSats
}: ExitSectionProps) {
  const satsUnit = t('bitcoin.sats')
  const { data } = decoded

  return (
    <SSVStack gap="none" style={styles.section}>
      <SectionHeader
        title={t('ark.vtxo.detail.exit.title')}
        subtitle={t('ark.vtxo.detail.exit.subtitle')}
      />
      <SSDetailRow
        label={t('ark.vtxo.detail.exit.transactions')}
        value={formatNumber(data.chainDepth)}
      />
      <SSDetailRow
        label={t('ark.vtxo.detail.exit.delay')}
        value={t('ark.vtxo.detail.blocks', { count: data.exitDelta })}
      />
      {data.totalFees > 0 && (
        <SSDetailRow
          label={t('ark.vtxo.detail.exit.treeFees')}
          value={`${formatNumber(data.totalFees)} ${satsUnit}`}
        />
      )}
      {estimatedFeeSats !== undefined && (
        <SSDetailRow
          label={t('ark.vtxo.detail.exit.estimatedFee')}
          value={`~${formatNumber(estimatedFeeSats)} ${satsUnit}`}
        />
      )}
      <SSDetailRow
        label={t('ark.vtxo.detail.exit.ready')}
        value={data.isFullySigned ? t('common.yes') : t('common.no')}
        valueStyle={{
          color: data.isFullySigned ? Colors.mainGreen : Colors.warning
        }}
      />
      {estimatedFeeSats !== undefined &&
        isArkVtxoExitUneconomical(amountSats, estimatedFeeSats) && (
          <SSText size="xs" style={styles.warning}>
            {t('ark.vtxo.detail.exit.uneconomical')}
          </SSText>
        )}
    </SSVStack>
  )
}

type KeyRowProps = {
  label: string
  value: string
}

function KeyRow({ label, value }: KeyRowProps) {
  return (
    <SSVStack gap="xxs" style={styles.keyRow}>
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      <SSClipboardCopy text={value}>
        <SSText size="xs" style={styles.mono}>
          {value}
        </SSText>
      </SSClipboardCopy>
    </SSVStack>
  )
}

type MovementLinkProps = {
  accountId: string
  label: string
  movement: ArkMovement
}

function MovementLink({ accountId, label, movement }: MovementLinkProps) {
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  return (
    <SSVStack gap="none">
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      <SSArkMovementCard
        btcPrice={btcPrice}
        currencyUnit={currencyUnit}
        fiatCurrency={fiatCurrency}
        privacyMode={privacyMode}
        useZeroPadding={useZeroPadding}
        movement={movement}
        onPress={() =>
          router.navigate(
            `/signer/ark/account/${accountId}/movement/${movement.id}`
          )
        }
      />
    </SSVStack>
  )
}

function getVtxoStatusLabel(vtxo: ArkVtxo | undefined) {
  if (!vtxo) {
    return t('ark.vtxo.detail.notInWallet')
  }
  if (vtxo.spendable) {
    return t('ark.vtxo.spendable')
  }
  return `${t('ark.vtxo.locked')} · ${vtxo.state}`
}

export default function ArkVtxoDetailPage() {
  const { id, vtxoId } = useLocalSearchParams<{
    id: string
    vtxoId: string
  }>()
  const vtxosQuery = useArkVtxos(id)
  const decodeQuery = useArkVtxoDecode(id, vtxoId)
  const tipHeightQuery = useArkTipHeight(id)
  const serverInfoQuery = useArkServerInfo(id)
  const movementsQuery = useArkMovements(id)
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )
  const network = useArkStore(
    (state) => state.accounts.find((account) => account.id === id)?.network
  )
  const explorerBaseUrl = useBlockchainStore((state) =>
    network ? state.configsMempool[network] : undefined
  )

  const vtxo = vtxosQuery.data?.find((item) => item.id === vtxoId)
  const decoded = decodeQuery.data
  const exitFeeQuery = useArkExitFeeEstimate({
    accountId: id,
    enabled: Boolean(vtxo?.spendable),
    vtxos: vtxo ? [vtxo] : []
  })

  const amountSats = vtxo?.amountSats ?? decoded?.data.amount
  const expiryHeight = vtxo?.expiryHeight ?? decoded?.data.expiryHeight
  const tipHeight = tipHeightQuery.data
  const lifetimeBlocks = serverInfoQuery.data?.vtxoLifetime
  const expiry =
    expiryHeight !== undefined &&
    tipHeight !== undefined &&
    lifetimeBlocks !== undefined
      ? getArkVtxoExpiry({ expiryHeight, lifetimeBlocks, tipHeight })
      : undefined
  const { createdBy, spentBy } = findArkVtxoMovements(
    movementsQuery.data ?? [],
    vtxoId
  )
  const isLoading = vtxosQuery.isLoading || decodeQuery.isLoading

  async function handleCopyEncoded() {
    if (!decoded) {
      return
    }
    const copied = await setClipboard(decoded.encoded)
    if (copied) {
      toast.success(t('common.copiedToClipboard'))
    }
  }

  function handleOpenAnchor() {
    if (!decoded || !explorerBaseUrl) {
      return
    }
    WebBrowser.openBrowserAsync(
      `${explorerBaseUrl}/tx/${decoded.data.anchorPoint.txid}`
    )
  }

  function renderBody() {
    if (amountSats === undefined) {
      return (
        <SSVStack itemsCenter style={styles.loading}>
          <SSText color="muted">
            {isLoading ? t('common.loading') : t('ark.vtxo.detail.notFound')}
          </SSText>
        </SSVStack>
      )
    }

    const policyKey = decoded
      ? getArkVtxoPolicyKey(decoded.data.policy)
      : undefined
    const paymentHash = decoded
      ? getArkVtxoPolicyPaymentHash(decoded.data.policy)
      : undefined

    return (
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          <SSVStack itemsCenter gap="sm" style={styles.summary}>
            <SSHStack gap="xs" style={styles.amountRow}>
              <SSAmountDisplay
                privacyMode={privacyMode}
                amount={amountSats}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                noColor
                showSign={false}
                textSize="4xl"
                weight="ultralight"
                letterSpacing={-1}
                unitSize="lg"
              />
            </SSHStack>
            {btcPrice > 0 && (
              <SSText color="muted" size="sm">
                {privacyMode
                  ? `•••• ${fiatCurrency}`
                  : `${formatFiatPrice(amountSats, btcPrice)} ${fiatCurrency}`}
              </SSText>
            )}
            <SSText uppercase size="xs" color="muted">
              {getVtxoStatusLabel(vtxo)}
            </SSText>
          </SSVStack>

          {expiry && expiryHeight !== undefined && (
            <ExpirySection expiry={expiry} expiryHeight={expiryHeight} />
          )}

          {vtxo?.spendable && <RefreshAction accountId={id} vtxoId={vtxoId} />}

          <SSVStack gap="md" style={styles.section}>
            <SectionHeader
              title={t('ark.vtxo.detail.lineage.title')}
              subtitle={t('ark.vtxo.detail.lineage.subtitle')}
            />
            {decoded && (
              <SSArkVtxoLineage
                anchor={decoded.data.anchorPoint}
                steps={buildArkVtxoLineage(decoded.data)}
                amountSats={amountSats}
                vtxoId={vtxoId}
                privacyMode={privacyMode}
              />
            )}
            {decodeQuery.isLoading && (
              <SSText size="xs" color="muted">
                {t('common.loading')}
              </SSText>
            )}
            {decodeQuery.error && (
              <SSText size="xs" style={styles.error}>
                {t('ark.vtxo.detail.decodeError', {
                  message: decodeQuery.error.message
                })}
              </SSText>
            )}
            {decoded && explorerBaseUrl && (
              <SSButton
                variant="outline"
                label={t('ark.vtxo.detail.lineage.viewAnchor')}
                onPress={handleOpenAnchor}
              />
            )}
          </SSVStack>

          {decoded && (
            <ExitSection
              amountSats={amountSats}
              decoded={decoded}
              estimatedFeeSats={exitFeeQuery.data?.feeSats}
            />
          )}

          {(createdBy || spentBy) && (
            <SSVStack gap="sm" style={styles.section}>
              <SectionHeader title={t('ark.vtxo.detail.history.title')} />
              {createdBy && (
                <MovementLink
                  accountId={id}
                  label={t('ark.vtxo.detail.history.createdBy')}
                  movement={createdBy}
                />
              )}
              {spentBy && (
                <MovementLink
                  accountId={id}
                  label={t('ark.vtxo.detail.history.spentBy')}
                  movement={spentBy}
                />
              )}
            </SSVStack>
          )}

          <SSVStack gap="xs" style={styles.section}>
            <SectionHeader title={t('ark.vtxo.detail.technical.title')} />
            <KeyRow label={t('ark.vtxo.detail.technical.id')} value={vtxoId} />
            {decoded && (
              <SSDetailRow
                label={t('ark.vtxo.detail.technical.policy')}
                value={decoded.data.policy.kind}
              />
            )}
            {policyKey && (
              <KeyRow
                label={t('ark.vtxo.detail.technical.policyKey')}
                value={policyKey}
              />
            )}
            {paymentHash && (
              <KeyRow
                label={t('ark.vtxo.detail.technical.paymentHash')}
                value={paymentHash}
              />
            )}
            {decoded && (
              <KeyRow
                label={t('ark.vtxo.detail.technical.serverKey')}
                value={decoded.data.serverPubkey}
              />
            )}
            {decoded && (
              <SSButton
                variant="outline"
                label={t('ark.vtxo.detail.technical.copyEncoded')}
                onPress={handleCopyEncoded}
              />
            )}
          </SSVStack>
        </SSVStack>
      </ScrollView>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.vtxo.detail.title')}</SSText>
          )
        }}
      />
      {renderBody()}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  amountRow: {
    alignItems: 'baseline'
  },
  container: {
    paddingBottom: 60,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  error: {
    color: Colors.mainRed
  },
  fill: {
    borderRadius: 2,
    height: '100%'
  },
  keyRow: {
    paddingVertical: 8
  },
  loading: {
    paddingTop: 60
  },
  mono: {
    fontFamily: Typography.geistMonoRegular
  },
  section: {
    width: '100%'
  },
  summary: {
    paddingVertical: 12
  },
  track: {
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    height: 4,
    overflow: 'hidden',
    width: '100%'
  },
  warning: {
    color: Colors.warning,
    paddingTop: 4
  }
})
