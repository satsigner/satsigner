import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSShareableQR from '@/components/SSShareableQR'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { ARK_SWAP_DISMISS_CHECK_INTERVAL_MS } from '@/constants/ark'
import { PRIVACY_MASK } from '@/constants/privacy'
import { useNow } from '@/hooks/useNow'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import { type ArkSwapJob } from '@/types/models/ArkSwap'
import { canDismissArkSwapJob, canSubmitArkSwapInvoice } from '@/utils/arkSwap'
import { formatNumber } from '@/utils/format'

const QR_SIZE = 240

const STATUS_LABEL_KEYS: Record<ArkSwapJob['status'], string> = {
  awaitingFunding: 'ark.swap.job.status.awaitingFunding',
  awaitingInvoice: 'ark.swap.job.status.awaitingInvoice',
  awaitingPayment: 'ark.swap.job.status.awaitingPayment',
  boarding: 'ark.swap.job.status.boarding',
  completed: 'ark.swap.job.status.completed',
  failed: 'ark.swap.job.status.failed',
  paying: 'ark.swap.job.status.paying',
  sending: 'ark.swap.job.status.sending'
}

const TITLE_KEYS: Record<ArkSwapJob['kind'], string> = {
  lightningToOnchain: 'ark.swap.job.title.lightningToOnchain',
  onchainToLightning: 'ark.swap.job.title.onchainToLightning'
}

type SSArkSwapJobCardProps = {
  job: ArkSwapJob
  walletName: string | undefined
  maxInvoiceSats?: number
  privacyMode: boolean
  submitting: boolean
  onDismiss: (jobId: string) => void
  onSubmitInvoice: (jobId: string, invoice: string) => void
  onCopy: (value: string) => void
  onPaste: () => Promise<string | undefined>
}

function getStatusColor(status: ArkSwapJob['status']): string {
  if (status === 'completed') {
    return Colors.success
  }
  if (status === 'failed') {
    return Colors.warning
  }
  return Colors.gray[300]
}

function SSArkSwapJobCard({
  job,
  walletName,
  maxInvoiceSats,
  privacyMode,
  submitting,
  onDismiss,
  onSubmitInvoice,
  onCopy,
  onPaste
}: SSArkSwapJobCardProps) {
  const [invoice, setInvoice] = useState('')
  const nowMs = useNow(ARK_SWAP_DISMISS_CHECK_INTERVAL_MS)
  const amount = privacyMode ? PRIVACY_MASK : formatNumber(job.amountSats)
  const showInvoiceQr =
    job.kind === 'lightningToOnchain' && job.status === 'awaitingPayment'
  const payoutTxid =
    job.kind === 'lightningToOnchain' && job.status === 'completed'
      ? job.txid
      : undefined

  function handleDismiss() {
    onDismiss(job.id)
  }

  function handleSubmitInvoice() {
    onSubmitInvoice(job.id, invoice)
  }

  async function handlePaste() {
    const pasted = await onPaste()
    if (pasted) {
      setInvoice(pasted)
    }
  }

  function handleCopyInvoice() {
    if (job.kind === 'lightningToOnchain') {
      onCopy(job.invoice)
    }
  }

  return (
    <SSVStack gap="sm" style={styles.card}>
      <SSHStack justifyBetween>
        <SSText uppercase size="xs">
          {t(TITLE_KEYS[job.kind])}
        </SSText>
        <SSText size="xs" style={{ color: getStatusColor(job.status) }}>
          {t(STATUS_LABEL_KEYS[job.status])}
        </SSText>
      </SSHStack>
      <SSText color="muted" size="xs">
        {walletName
          ? `${amount} ${t('bitcoin.sats')} · ${walletName}`
          : `${amount} ${t('bitcoin.sats')}`}
      </SSText>
      {job.kind === 'lightningToOnchain' && job.payoutSats !== undefined && (
        <SSText color="muted" size="xs">
          {t('ark.swap.job.payout', {
            amount: privacyMode ? PRIVACY_MASK : formatNumber(job.payoutSats),
            unit: t('bitcoin.sats')
          })}
        </SSText>
      )}
      {job.error && (
        <SSText size="xs" style={{ color: Colors.warning }}>
          {job.error}
        </SSText>
      )}
      {showInvoiceQr && (
        <SSVStack gap="sm">
          <SSShareableQR
            value={job.invoice}
            size={QR_SIZE}
            containerStyle={styles.qrContainer}
          >
            <View style={styles.valueBox}>
              <SSText size="xs" style={styles.monospace} numberOfLines={3}>
                {job.invoice}
              </SSText>
            </View>
            <SSButton
              label={t('common.copy')}
              onPress={handleCopyInvoice}
              variant="outline"
            />
          </SSShareableQR>
          <SSText color="muted" size="xs" center>
            {t('ark.swap.job.keepAppOpen')}
          </SSText>
        </SSVStack>
      )}
      {payoutTxid && (
        <SSText size="xs" style={styles.monospace} numberOfLines={1}>
          {payoutTxid}
        </SSText>
      )}
      {canSubmitArkSwapInvoice(job) && (
        <SSVStack gap="xs">
          {maxInvoiceSats !== undefined && (
            <SSText size="xs">
              {t('ark.swap.job.invoiceHint', {
                amount: privacyMode
                  ? PRIVACY_MASK
                  : formatNumber(maxInvoiceSats),
                unit: t('bitcoin.sats')
              })}
            </SSText>
          )}
          <SSTextInput
            align="left"
            size="small"
            multiline
            style={styles.invoiceInput}
            value={invoice}
            onChangeText={setInvoice}
            placeholder={t('ark.swap.invoicePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <SSHStack gap="sm">
            <SSButton
              label={t('common.paste')}
              onPress={handlePaste}
              variant="outline"
              style={styles.flex}
            />
            <SSButton
              label={t('ark.swap.job.payInvoice')}
              onPress={handleSubmitInvoice}
              loading={submitting}
              disabled={invoice.trim() === ''}
              variant="secondary"
              style={styles.flex}
            />
          </SSHStack>
        </SSVStack>
      )}
      {canDismissArkSwapJob(job, nowMs) && (
        <SSButton
          label={t('common.dismiss')}
          onPress={handleDismiss}
          variant="subtle"
        />
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
  flex: {
    flex: 1
  },
  invoiceInput: {
    fontFamily: Typography.geistMonoRegular,
    height: 72,
    paddingTop: 10,
    textAlignVertical: 'top'
  },
  monospace: {
    fontFamily: Typography.geistMonoRegular
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 12
  },
  valueBox: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 10
  }
})

export default SSArkSwapJobCard
