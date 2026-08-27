import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { summarizeBackupPayload } from '@/utils/backupSummary'
import { formatBytes } from '@/utils/format'

export default function SSBackupPayloadSummary({
  payload
}: {
  payload: string
}) {
  const summary = summarizeBackupPayload(payload)
  const sizeLabel = t('settings.developer.backupSummarySize', {
    size: formatBytes(summary.bytes)
  })

  if (!summary.parseable) {
    return (
      <SSVStack gap="xs" widthFull>
        <SSText color="muted">{sizeLabel}</SSText>
        <SSText color="muted">
          {t('settings.developer.backupSummaryInvalid')}
        </SSText>
      </SSVStack>
    )
  }

  return (
    <SSVStack gap="xs" widthFull>
      <SSText color="muted">{sizeLabel}</SSText>
      <SSText color="muted">
        {t('settings.developer.backupSummaryAccounts', {
          count: summary.bitcoinAccounts
        })}
      </SSText>
      <SSText color="muted">
        {t('settings.developer.backupSummaryArk', {
          count: summary.arkAccounts
        })}
      </SSText>
      {summary.arkDatadirAccounts > 0 ? (
        <SSText color="muted">
          {t('settings.developer.backupSummaryArkDatadirs', {
            count: summary.arkDatadirAccounts
          })}
        </SSText>
      ) : null}
      <SSText color="muted">
        {t('settings.developer.backupSummaryEcash', {
          count: summary.ecashAccounts
        })}
      </SSText>
    </SSVStack>
  )
}
