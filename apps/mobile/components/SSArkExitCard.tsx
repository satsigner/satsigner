import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type ArkExit, type ArkExitStatus } from '@/types/models/Ark'
import {
  type ArkExitTone,
  getArkExitBlocksUntilClaimable,
  getArkExitConfirmationRatio,
  getArkExitTone
} from '@/utils/arkExit'
import { getArkVtxoEta } from '@/utils/arkVtxoDetail'
import { formatMaskedSats, formatNumber, formatTxId } from '@/utils/format'

const STATUS_LABEL_KEYS: Record<ArkExitStatus, string> = {
  alreadySpent: 'ark.exit.status.alreadySpent',
  awaitingDelta: 'ark.exit.status.awaitingDelta',
  canceled: 'ark.exit.status.canceled',
  claimInProgress: 'ark.exit.status.claimInProgress',
  claimable: 'ark.exit.status.claimable',
  claimed: 'ark.exit.status.claimed',
  processing: 'ark.exit.status.processing',
  starting: 'ark.exit.status.starting',
  swept: 'ark.exit.status.swept'
}

const FAILURE_DESCRIPTION_KEYS: Partial<Record<ArkExitStatus, string>> = {
  alreadySpent: 'ark.exit.failure.alreadySpent',
  canceled: 'ark.exit.failure.canceled',
  swept: 'ark.exit.failure.swept'
}

const TONE_COLORS: Record<ArkExitTone, string> = {
  done: Colors.gray[400],
  failed: Colors.error,
  progress: Colors.gray[200],
  ready: Colors.success
}

const PERCENT = 100

type SSArkExitCardProps = {
  exit: ArkExit
  privacyMode: boolean
  onCopyTxid: (txid: string) => void
}

function getProgressText(exit: ArkExit): string | undefined {
  if (exit.status === 'starting') {
    return t('ark.exit.progress.starting')
  }
  if (exit.status === 'processing' && exit.totalTxCount) {
    return t('ark.exit.progress.transactions', {
      confirmed: exit.confirmedTxCount ?? 0,
      total: exit.totalTxCount
    })
  }
  const blocksLeft = getArkExitBlocksUntilClaimable(exit)
  if (blocksLeft !== undefined && exit.claimableAtHeight !== undefined) {
    const eta = getArkVtxoEta(blocksLeft)
    return t('ark.exit.progress.claimableAt', {
      eta: t(`ark.vtxo.detail.eta.${eta.unit}`, { count: eta.count }),
      height: formatNumber(exit.claimableAtHeight)
    })
  }
  if (exit.status === 'claimable') {
    return t('ark.exit.progress.claimable')
  }
  if (exit.status === 'claimInProgress') {
    return t('ark.exit.progress.claimInProgress')
  }
  const failureKey = FAILURE_DESCRIPTION_KEYS[exit.status]
  return failureKey ? t(failureKey) : undefined
}

function SSArkExitCard({ exit, privacyMode, onCopyTxid }: SSArkExitCardProps) {
  const tone = getArkExitTone(exit.status)
  const toneColor = TONE_COLORS[tone]
  const progressText = getProgressText(exit)
  const confirmationRatio = getArkExitConfirmationRatio(exit)
  const amount =
    exit.amountSats === undefined
      ? undefined
      : formatMaskedSats(exit.amountSats, privacyMode)

  function handleCopyTxid() {
    if (exit.claimTxid) {
      onCopyTxid(exit.claimTxid)
    }
  }

  return (
    <SSVStack
      gap="sm"
      style={[styles.card, tone === 'ready' && styles.cardReady]}
    >
      <SSHStack justifyBetween>
        <SSText size="md" weight="medium">
          {amount ?? t('ark.exit.unknownAmount')}
        </SSText>
        <SSHStack gap="xs">
          <View style={[styles.dot, { backgroundColor: toneColor }]} />
          <SSText size="xs" uppercase style={{ color: toneColor }}>
            {t(STATUS_LABEL_KEYS[exit.status])}
          </SSText>
        </SSHStack>
      </SSHStack>
      <SSText
        color="muted"
        size="xs"
        numberOfLines={1}
        ellipsizeMode="middle"
        type="mono"
      >
        {exit.vtxoId}
      </SSText>
      {confirmationRatio !== undefined && (
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(confirmationRatio * PERCENT)}%` }
            ]}
          />
        </View>
      )}
      {progressText && (
        <SSText
          size="sm"
          color="muted"
          style={tone === 'failed' && styles.failureText}
        >
          {progressText}
        </SSText>
      )}
      {exit.awaitingCpfpBroadcast && (
        <SSText size="sm" style={styles.warningText}>
          {t('ark.exit.progress.awaitingFunds')}
        </SSText>
      )}
      {exit.claimTxid && (
        <SSText size="xs" color="muted" type="mono" onPress={handleCopyTxid}>
          {t('ark.exit.claimTxid', { txid: formatTxId(exit.claimTxid) })}
        </SSText>
      )}
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
  cardReady: {
    borderColor: Colors.success
  },
  dot: {
    borderRadius: 3,
    height: 6,
    width: 6
  },
  failureText: {
    color: Colors.error
  },
  fill: {
    backgroundColor: Colors.white,
    borderRadius: 2,
    height: '100%'
  },
  track: {
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    height: 4,
    overflow: 'hidden'
  },
  warningText: {
    color: Colors.warning
  }
})

export default SSArkExitCard
