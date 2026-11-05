import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSDetailRow from '@/components/SSDetailRow'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import {
  type ArkExitClaimBroadcastStatus,
  type ArkExitClaimRecord
} from '@/types/models/Ark'
import { formatMaskedNumber, formatTxId } from '@/utils/format'

const STATUS_LABEL_KEYS: Record<ArkExitClaimBroadcastStatus, string> = {
  broadcast: 'ark.exit.claim.record.status.broadcast',
  broadcasting: 'ark.exit.claim.record.status.broadcasting',
  failed: 'ark.exit.claim.record.status.failed'
}

const STATUS_COLORS: Record<ArkExitClaimBroadcastStatus, string> = {
  broadcast: Colors.success,
  broadcasting: Colors.gray[200],
  failed: Colors.error
}

type SSArkExitClaimRecordCardProps = {
  record: ArkExitClaimRecord
  destinationName: string | undefined
  privacyMode: boolean
  retrying: boolean
  onRetry: (txid: string) => void
  onDiscard: (txid: string) => void
  onCopyTxid: (txid: string) => void
}

function SSArkExitClaimRecordCard({
  record,
  destinationName,
  privacyMode,
  retrying,
  onRetry,
  onDiscard,
  onCopyTxid
}: SSArkExitClaimRecordCardProps) {
  const unit = t('bitcoin.sats')
  const failed = record.broadcastStatus === 'failed'

  function handleRetry() {
    onRetry(record.txid)
  }

  function handleDiscard() {
    onDiscard(record.txid)
  }

  function handleCopyTxid() {
    onCopyTxid(record.txid)
  }

  return (
    <SSVStack gap="sm" style={styles.card}>
      <SSHStack justifyBetween>
        <SSText uppercase size="xs">
          {destinationName
            ? t('ark.exit.claim.record.title', { name: destinationName })
            : t('ark.exit.claim.record.titleUnknown')}
        </SSText>
        <SSText
          size="xs"
          uppercase
          style={{ color: STATUS_COLORS[record.broadcastStatus] }}
        >
          {t(STATUS_LABEL_KEYS[record.broadcastStatus])}
        </SSText>
      </SSHStack>
      <SSVStack gap="none">
        <SSDetailRow
          label={t('ark.exit.claim.receive')}
          value={`${formatMaskedNumber(record.amountSats, privacyMode)} ${unit}`}
        />
        <SSDetailRow
          label={t('ark.exit.claim.fee')}
          value={`${formatMaskedNumber(record.feeSats, privacyMode)} ${unit}`}
        />
      </SSVStack>
      <SSText size="xs" color="muted" type="mono" onPress={handleCopyTxid}>
        {formatTxId(record.txid)}
      </SSText>
      <SSText size="xs" color="muted">
        {t(
          failed
            ? 'ark.exit.claim.record.failedHint'
            : 'ark.exit.claim.record.pendingHint'
        )}
      </SSText>
      <SSHStack gap="sm">
        <SSButton
          label={t('ark.exit.claim.record.retry')}
          onPress={handleRetry}
          loading={retrying}
          disabled={retrying}
          variant="outline"
          style={styles.flex}
        />
        {failed && (
          <SSButton
            label={t('ark.exit.claim.record.discard')}
            onPress={handleDiscard}
            disabled={retrying}
            variant="subtle"
            style={styles.flex}
          />
        )}
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  flex: {
    flex: 1
  }
})

export default SSArkExitClaimRecordCard
