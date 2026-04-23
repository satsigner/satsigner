import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOutgoing,
  SSIconOutgoingLightning,
  SSIconRefresh
} from '@/components/icons'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useArkMovements } from '@/hooks/useArkMovements'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type {
  ArkMovement,
  ArkMovementKind,
  ArkMovementStatus
} from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementKind,
  isLightningMovement
} from '@/utils/arkMovement'
import { formatDate, formatFiatPrice, formatNumber } from '@/utils/format'

const ICON_SIZE = 28

function getStatusColor(status: ArkMovementStatus | string) {
  switch (status) {
    case 'pending':
      return Colors.warning
    case 'successful':
      return Colors.softBarGreen
    case 'failed':
    case 'canceled':
      return Colors.error
    default:
      return Colors.gray[400]
  }
}

function getStatusLabel(status: ArkMovementStatus | string) {
  switch (status) {
    case 'pending':
      return t('ark.movement.status.pending')
    case 'successful':
      return t('ark.movement.status.successful')
    case 'failed':
      return t('ark.movement.status.failed')
    case 'canceled':
      return t('ark.movement.status.canceled')
    default:
      return status.toUpperCase()
  }
}

function getKindLabel(kind: ArkMovementKind) {
  switch (kind) {
    case 'receive':
      return t('ark.movement.kind.receive')
    case 'send':
      return t('ark.movement.kind.send')
    case 'refresh':
      return t('ark.movement.kind.refresh')
    default:
      return ''
  }
}

function renderDirectionIcon(kind: ArkMovementKind, isLightning: boolean) {
  if (kind === 'refresh') {
    return <SSIconRefresh height={ICON_SIZE} width={ICON_SIZE} />
  }
  if (kind === 'receive') {
    return isLightning ? (
      <SSIconIncomingLightning height={ICON_SIZE} width={ICON_SIZE} />
    ) : (
      <SSIconIncoming height={ICON_SIZE} width={ICON_SIZE} />
    )
  }
  return isLightning ? (
    <SSIconOutgoingLightning height={ICON_SIZE} width={ICON_SIZE} />
  ) : (
    <SSIconOutgoing height={ICON_SIZE} width={ICON_SIZE} />
  )
}

function formatSignedSats(amount: number) {
  if (amount === 0) {
    return formatNumber(0)
  }
  if (amount > 0) {
    return `+${formatNumber(amount)}`
  }
  return `−${formatNumber(Math.abs(amount))}`
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }
  return formatDate(value)
}

function parseMetadata(raw: string) {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

type DetailRowProps = {
  label: string
  value: string
  valueStyle?: { color: string }
}

function DetailRow({ label, value, valueStyle }: DetailRowProps) {
  return (
    <SSHStack justifyBetween style={styles.detailRow}>
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      <SSText size="sm" style={[styles.detailValue, valueStyle]}>
        {value}
      </SSText>
    </SSHStack>
  )
}

type AddressListProps = {
  label: string
  values: string[]
}

function AddressList({ label, values }: AddressListProps) {
  if (values.length === 0) {
    return null
  }
  return (
    <SSVStack style={styles.section} gap="xs">
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      {values.map((value, index) => (
        <View key={`${label}-${index}`} style={styles.codeBox}>
          <SSText size="xs" style={styles.monospace}>
            {value}
          </SSText>
        </View>
      ))}
    </SSVStack>
  )
}

function MovementSummary({ movement }: { movement: ArkMovement }) {
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

  const kind = getArkMovementKind(movement)
  const amountSats = getArkMovementAmountSats(movement)
  const isLightning = isLightningMovement(movement)

  return (
    <SSVStack itemsCenter gap="sm" style={styles.summary}>
      {renderDirectionIcon(kind, isLightning)}
      <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
        {privacyMode ? (
          <SSText size="4xl" weight="ultralight" style={{ letterSpacing: -1 }}>
            ••••
          </SSText>
        ) : kind === 'refresh' && amountSats === 0 ? (
          <SSText size="2xl" weight="light" color="muted">
            {t('ark.movement.refreshLabel')}
          </SSText>
        ) : (
          <SSStyledSatText
            amount={amountSats}
            decimals={0}
            useZeroPadding={useZeroPadding}
            currency={currencyUnit}
            type={kind === 'receive' ? 'receive' : 'send'}
            noColor={kind === 'refresh'}
            textSize="4xl"
            weight="ultralight"
            letterSpacing={-1}
          />
        )}
        <SSText size="lg" color="muted">
          {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
        </SSText>
      </SSHStack>
      {btcPrice > 0 && amountSats > 0 && kind !== 'refresh' && (
        <SSText color="muted" size="sm">
          {privacyMode
            ? `•••• ${fiatCurrency}`
            : `${formatFiatPrice(amountSats, btcPrice)} ${fiatCurrency}`}
        </SSText>
      )}
      <SSText
        uppercase
        size="xs"
        style={{ color: getStatusColor(movement.status) }}
      >
        {getStatusLabel(movement.status)}
      </SSText>
    </SSVStack>
  )
}

export default function ArkMovementDetailPage() {
  const { id, movementId } = useLocalSearchParams<{
    id: string
    movementId: string
  }>()
  const movementsQuery = useArkMovements(id)

  const numericMovementId = Number(movementId)
  const movement = movementsQuery.data?.find(
    (item) => item.id === numericMovementId
  )

  const satsUnit = t('bitcoin.sats')

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.movement.detail.title')}</SSText>
          )
        }}
      />
      {movementsQuery.isLoading && !movement ? (
        <SSVStack itemsCenter style={styles.loading}>
          <SSText color="muted">{t('common.loading')}</SSText>
        </SSVStack>
      ) : !movement ? (
        <SSVStack itemsCenter style={styles.loading}>
          <SSText color="muted">{t('ark.movement.notFound')}</SSText>
        </SSVStack>
      ) : (
        <ScrollView>
          <SSVStack gap="lg" style={styles.container}>
            <MovementSummary movement={movement} />
            <SSVStack gap="none" style={styles.section}>
              <DetailRow
                label={t('ark.movement.detail.kind')}
                value={getKindLabel(getArkMovementKind(movement))}
              />
              <DetailRow
                label={t('ark.movement.detail.status')}
                value={getStatusLabel(movement.status)}
                valueStyle={{ color: getStatusColor(movement.status) }}
              />
              <DetailRow
                label={t('ark.movement.detail.subsystem')}
                value={`${movement.subsystemKind} · ${movement.subsystemName}`}
              />
              <DetailRow
                label={t('ark.movement.detail.effectiveBalance')}
                value={`${formatSignedSats(movement.effectiveBalanceSats)} ${satsUnit}`}
              />
              <DetailRow
                label={t('ark.movement.detail.intendedBalance')}
                value={`${formatSignedSats(movement.intendedBalanceSats)} ${satsUnit}`}
              />
              {movement.offchainFeeSats > 0 && (
                <DetailRow
                  label={t('ark.movement.detail.fee')}
                  value={`${formatNumber(movement.offchainFeeSats)} ${satsUnit}`}
                />
              )}
              <DetailRow
                label={t('ark.movement.detail.createdAt')}
                value={formatTimestamp(movement.createdAt) ?? ''}
              />
              <DetailRow
                label={t('ark.movement.detail.updatedAt')}
                value={formatTimestamp(movement.updatedAt) ?? ''}
              />
              {movement.completedAt && (
                <DetailRow
                  label={t('ark.movement.detail.completedAt')}
                  value={formatTimestamp(movement.completedAt) ?? ''}
                />
              )}
            </SSVStack>
            <AddressList
              label={t('ark.movement.detail.addressesSent')}
              values={movement.sentToAddresses}
            />
            <AddressList
              label={t('ark.movement.detail.addressesReceived')}
              values={movement.receivedOnAddresses}
            />
            <AddressList
              label={t('ark.movement.detail.inputVtxos')}
              values={movement.inputVtxoIds}
            />
            <AddressList
              label={t('ark.movement.detail.outputVtxos')}
              values={movement.outputVtxoIds}
            />
            <AddressList
              label={t('ark.movement.detail.exitedVtxos')}
              values={movement.exitedVtxoIds}
            />
            <SSVStack style={styles.section} gap="xs">
              <SSText color="muted" size="sm">
                {t('ark.movement.detail.metadata')}
              </SSText>
              <View style={styles.codeBox}>
                <SSText size="xs" style={styles.monospace}>
                  {parseMetadata(movement.metadataJson) ??
                    t('ark.movement.detail.noMetadata')}
                </SSText>
              </View>
            </SSVStack>
          </SSVStack>
        </ScrollView>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  codeBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  container: {
    paddingBottom: 60,
    paddingHorizontal: 20,
    paddingTop: 20
  },
  detailRow: {
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right'
  },
  loading: {
    paddingTop: 60
  },
  monospace: {
    fontFamily: 'monospace'
  },
  section: {
    width: '100%'
  },
  summary: {
    paddingVertical: 12
  }
})
