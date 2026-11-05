import { router, Stack, useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconChevronRight } from '@/components/icons'
import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSArkMovementIcon from '@/components/SSArkMovementIcon'
import SSDetailRow from '@/components/SSDetailRow'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSText from '@/components/SSText'
import { useArkLabels } from '@/hooks/useArkLabels'
import { useArkMovements } from '@/hooks/useArkMovements'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Typography } from '@/styles'
import type { ArkMovement } from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementKind,
  getArkMovementKindLabel,
  getArkMovementLabelRef,
  getArkMovementSatTextType,
  getArkMovementStatusColor,
  getArkMovementStatusLabel,
  getArkMovementTxids,
  isLightningMovement,
  parseArkCounterparty
} from '@/utils/arkMovement'
import { getArkVtxoRoute } from '@/utils/arkVtxoDetail'
import {
  formatDate,
  formatFiatPrice,
  formatNumber,
  formatTime
} from '@/utils/format'

const ICON_SIZE = 28
const CHEVRON_HEIGHT = 11.6
const CHEVRON_WIDTH = 6

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
  const date = new Date(value)
  return `${formatDate(date)} ${formatTime(date)}`
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

type AddressListProps = {
  label: string
  values: string[]
}

function TxidList({ txids }: { txids: string[] }) {
  if (txids.length === 0) {
    return null
  }
  return (
    <SSVStack style={styles.section} gap="xs">
      <SSText color="muted" size="sm">
        {t('ark.movement.detail.txid')}
      </SSText>
      {txids.map((txid) => (
        <SSAddressDisplay key={txid} address={txid} variant="outline" />
      ))}
    </SSVStack>
  )
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
            {parseArkCounterparty(value)}
          </SSText>
        </View>
      ))}
    </SSVStack>
  )
}

type VtxoListProps = {
  accountId: string
  label: string
  vtxoIds: string[]
}

function VtxoList({ accountId, label, vtxoIds }: VtxoListProps) {
  if (vtxoIds.length === 0) {
    return null
  }
  return (
    <SSVStack style={styles.section} gap="xs">
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      {vtxoIds.map((vtxoId) => (
        <Pressable
          key={vtxoId}
          accessibilityRole="link"
          onPress={() => router.navigate(getArkVtxoRoute(accountId, vtxoId))}
        >
          <SSHStack gap="sm" style={styles.codeBox}>
            <SSText size="xs" style={[styles.monospace, styles.vtxoId]}>
              {vtxoId}
            </SSText>
            <SSIconChevronRight height={CHEVRON_HEIGHT} width={CHEVRON_WIDTH} />
          </SSHStack>
        </Pressable>
      ))}
    </SSVStack>
  )
}

export function MovementSummary({ movement }: { movement: ArkMovement }) {
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
      <SSArkMovementIcon
        kind={kind}
        isLightning={isLightning}
        size={ICON_SIZE}
      />
      <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
        {!privacyMode && kind === 'refresh' && amountSats === 0 ? (
          <SSText size="2xl" weight="light" color="muted">
            {t('ark.movement.refreshLabel')}
          </SSText>
        ) : (
          <SSAmountDisplay
            privacyMode={privacyMode}
            amount={amountSats}
            decimals={0}
            useZeroPadding={useZeroPadding}
            currency={currencyUnit}
            type={getArkMovementSatTextType(kind)}
            noColor={kind === 'refresh'}
            showSign={false}
            textSize="4xl"
            weight="ultralight"
            letterSpacing={-1}
            unitSize="lg"
          />
        )}
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
        style={{ color: getArkMovementStatusColor(movement.status) }}
      >
        {getArkMovementStatusLabel(movement.status)}
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
  const labelsQuery = useArkLabels(id)
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const numericMovementId = Number(movementId)
  const movement = movementsQuery.data?.find(
    (item) => item.id === numericMovementId
  )
  const movementLabel = movement
    ? (labelsQuery.data?.[getArkMovementLabelRef(movement)]?.label ?? '')
    : ''

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
            <SSLabelDetails
              label={movementLabel}
              onPress={() =>
                router.navigate(
                  `/signer/ark/account/${id}/movement/${movementId}/label`
                )
              }
              header={t('transaction.label')}
              privacyMode={privacyMode}
            />
            <TxidList txids={getArkMovementTxids(movement)} />
            <SSVStack gap="none" style={styles.section}>
              <SSDetailRow
                label={t('ark.movement.detail.kind')}
                value={getArkMovementKindLabel(getArkMovementKind(movement))}
              />
              <SSDetailRow
                label={t('ark.movement.detail.status')}
                value={getArkMovementStatusLabel(movement.status)}
                valueStyle={{
                  color: getArkMovementStatusColor(movement.status)
                }}
              />
              <SSDetailRow
                label={t('ark.movement.detail.subsystem')}
                value={`${movement.subsystemKind} · ${movement.subsystemName}`}
              />
              <SSDetailRow
                label={t('ark.movement.detail.effectiveBalance')}
                value={`${formatSignedSats(movement.effectiveBalanceSats)} ${satsUnit}`}
              />
              <SSDetailRow
                label={t('ark.movement.detail.intendedBalance')}
                value={`${formatSignedSats(movement.intendedBalanceSats)} ${satsUnit}`}
              />
              {movement.offchainFeeSats > 0 && (
                <SSDetailRow
                  label={t('ark.movement.detail.fee')}
                  value={`${formatNumber(movement.offchainFeeSats)} ${satsUnit}`}
                />
              )}
              <SSDetailRow
                label={t('ark.movement.detail.createdAt')}
                value={formatTimestamp(movement.createdAt) ?? ''}
              />
              <SSDetailRow
                label={t('ark.movement.detail.updatedAt')}
                value={formatTimestamp(movement.updatedAt) ?? ''}
              />
              {movement.completedAt && (
                <SSDetailRow
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
            <VtxoList
              accountId={id}
              label={t('ark.movement.detail.inputVtxos')}
              vtxoIds={movement.inputVtxoIds}
            />
            <VtxoList
              accountId={id}
              label={t('ark.movement.detail.outputVtxos')}
              vtxoIds={movement.outputVtxoIds}
            />
            <VtxoList
              accountId={id}
              label={t('ark.movement.detail.exitedVtxos')}
              vtxoIds={movement.exitedVtxoIds}
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
  loading: {
    paddingTop: 60
  },
  monospace: {
    fontFamily: Typography.geistMonoRegular
  },
  section: {
    width: '100%'
  },
  summary: {
    paddingVertical: 12
  },
  vtxoId: {
    flex: 1
  }
})
