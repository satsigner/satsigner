import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { summarizeBackupPayload } from '@/utils/backupSummary'
import { formatBytes } from '@/utils/format'

const DETAIL_SEPARATOR = ' · '

function joinDetails(primary: number, extras: (string | undefined)[]): string {
  return [
    String(primary),
    ...extras.filter((extra) => extra !== undefined)
  ].join(DETAIL_SEPARATOR)
}

function detailCount(count: number, key: string): string | undefined {
  if (count === 0) {
    return undefined
  }
  return t(key, { count })
}

function SummaryRow({
  label,
  showSeparator,
  value
}: {
  label: string
  showSeparator?: boolean
  value: string
}) {
  return (
    <SSVStack gap="xs" widthFull>
      <SSHStack justifyBetween style={{ width: '100%' }}>
        <SSText color="muted" size="sm">
          {label}
        </SSText>
        <SSText
          color="muted"
          size="xs"
          type="mono"
          style={{ flexShrink: 1, textAlign: 'right' }}
        >
          {value}
        </SSText>
      </SSHStack>
      {showSeparator ? <SSSeparator color="grayDark" /> : null}
    </SSVStack>
  )
}

export default function SSBackupPayloadSummary({
  payload
}: {
  payload: string
}) {
  const summary = summarizeBackupPayload(payload)
  const sizeLabel = t('settings.developer.backupSummarySize')
  const sizeValue = formatBytes(summary.bytes)

  if (!summary.parseable) {
    return (
      <SSVStack gap="xs" widthFull>
        <SummaryRow label={sizeLabel} value={sizeValue} />
        <SSText color="muted">
          {t('settings.developer.backupSummaryInvalid')}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <SSVStack gap="xs" widthFull>
      <SummaryRow label={sizeLabel} showSeparator value={sizeValue} />
      <SummaryRow
        label={t('settings.developer.backupSummaryBitcoin')}
        showSeparator
        value={joinDetails(summary.bitcoin.accounts, [
          detailCount(
            summary.bitcoin.labels,
            'settings.developer.backupSummaryDetailLabels'
          ),
          detailCount(
            summary.bitcoin.secrets,
            'settings.developer.backupSummaryDetailSecrets'
          )
        ])}
      />
      <SummaryRow
        label={t('settings.developer.backupSummaryArk')}
        showSeparator
        value={joinDetails(summary.ark.accounts, [
          detailCount(
            summary.ark.labels,
            'settings.developer.backupSummaryDetailLabels'
          ),
          detailCount(
            summary.ark.secrets,
            'settings.developer.backupSummaryDetailSecrets'
          ),
          detailCount(
            summary.ark.datadirs,
            'settings.developer.backupSummaryDetailDatadirs'
          )
        ])}
      />
      <SummaryRow
        label={t('settings.developer.backupSummaryEcash')}
        showSeparator
        value={joinDetails(summary.ecash.accounts, [
          detailCount(
            summary.ecash.proofs,
            'settings.developer.backupSummaryDetailProofs'
          ),
          detailCount(
            summary.ecash.secrets,
            'settings.developer.backupSummaryDetailSecrets'
          ),
          detailCount(
            summary.ecash.mints,
            'settings.developer.backupSummaryDetailMints'
          ),
          detailCount(
            summary.ecash.transactions,
            'settings.developer.backupSummaryDetailTransactions'
          )
        ])}
      />
      <SummaryRow
        label={t('settings.developer.backupSummaryNostr')}
        showSeparator
        value={joinDetails(summary.nostr.accounts, [
          detailCount(
            summary.nostr.secrets,
            'settings.developer.backupSummaryDetailSecrets'
          ),
          detailCount(
            summary.nostr.relays,
            'settings.developer.backupSummaryDetailRelays'
          )
        ])}
      />
      <SummaryRow
        label={t('settings.developer.backupSummaryLightning')}
        showSeparator
        value={[
          t('settings.developer.backupSummaryDetailChannels', {
            count: summary.lightning.channels
          }),
          summary.lightning.hasConfig
            ? t('settings.developer.backupSummaryDetailConfig')
            : t('settings.developer.backupSummaryDetailConfigMissing')
        ].join(DETAIL_SEPARATOR)}
      />
    </SSVStack>
  )
}
