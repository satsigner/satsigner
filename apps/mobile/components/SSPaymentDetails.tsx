import { StyleSheet, View } from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Typography } from '@/styles'

type DecodedInvoice = {
  payment_request: string
  value: string
  description: string
  timestamp: string
  expiry: string
  payment_hash: string
  payment_addr: string
  num_satoshis: string
  num_msat: string
  features: Record<string, { name: string }>
  route_hints: unknown[]
  payment_secret: string
  min_final_cltv_expiry: string
}

type SSPaymentDetailsProps = {
  decodedInvoice: DecodedInvoice
  fiatCurrency: string
  privacyMode?: boolean
  satsToFiat: (amount: number) => number
  showCreated?: boolean
  showPaymentHash?: boolean
}

const MS_MIN = 60_000
const MS_HOUR = 3_600_000
const MS_DAY = 86_400_000
const MS_48H = 48 * MS_HOUR

function formatAbsoluteDateParts(date: Date) {
  return {
    datePart: date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    timePart: date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      hour12: true,
      minute: '2-digit'
    })
  }
}

function formatCreatedRelative(createdMs: number, nowMs: number): string {
  const ms = Math.max(0, nowMs - createdMs)
  if (ms < MS_MIN) {
    return t('lightning.paymentDetails.relative.justNow')
  }
  if (ms < MS_HOUR) {
    return t('lightning.paymentDetails.relative.minutesAgo', {
      count: Math.max(1, Math.floor(ms / MS_MIN))
    })
  }
  if (ms < MS_48H) {
    return t('lightning.paymentDetails.relative.hoursAgo', {
      count: Math.max(1, Math.floor(ms / MS_HOUR))
    })
  }
  return t('lightning.paymentDetails.relative.daysAgo', {
    count: Math.max(1, Math.floor(ms / MS_DAY))
  })
}

function formatExpiresRelative(expiresMs: number, nowMs: number): string {
  const ms = expiresMs - nowMs
  if (ms <= 0) {
    return t('lightning.paymentDetails.relative.expired')
  }
  if (ms < MS_MIN) {
    return t('lightning.paymentDetails.relative.inMinutes', { count: 1 })
  }
  if (ms < MS_HOUR) {
    return t('lightning.paymentDetails.relative.inMinutes', {
      count: Math.max(1, Math.ceil(ms / MS_MIN))
    })
  }
  if (ms < MS_48H) {
    return t('lightning.paymentDetails.relative.inHours', {
      count: Math.max(1, Math.ceil(ms / MS_HOUR))
    })
  }
  return t('lightning.paymentDetails.relative.inDays', {
    count: Math.max(1, Math.ceil(ms / MS_DAY))
  })
}

function decodedInvoiceAmountSats(invoice: DecodedInvoice): number {
  const fromSatField = parseInt(invoice.num_satoshis, 10)
  if (!Number.isNaN(fromSatField) && fromSatField > 0) {
    return fromSatField
  }
  const msat = parseInt(invoice.num_msat, 10)
  if (!Number.isNaN(msat) && msat > 0) {
    return Math.ceil(msat / 1000)
  }
  const fromValue = parseInt(invoice.value, 10)
  if (!Number.isNaN(fromValue) && fromValue > 0) {
    return fromValue
  }
  return 0
}

function SSPaymentDetails({
  decodedInvoice,
  fiatCurrency,
  privacyMode = false,
  satsToFiat,
  showCreated = true,
  showPaymentHash = true
}: SSPaymentDetailsProps) {
  const amountSats = decodedInvoiceAmountSats(decodedInvoice)
  const nowMs = Date.now()
  const createdAt = new Date(Number(decodedInvoice.timestamp) * 1000)
  const expiresAt = new Date(
    Number(decodedInvoice.timestamp) * 1000 +
      Number(decodedInvoice.expiry) * 1000
  )
  const createdAbsolute = formatAbsoluteDateParts(createdAt)
  const expiresAbsolute = formatAbsoluteDateParts(expiresAt)

  return (
    <SSVStack gap="sm" style={styles.invoiceDetails}>
      <View style={styles.detailsContent}>
        <View style={styles.detailSection}>
          <SSVStack
            gap="sm"
            itemsCenter
            widthFull
            style={styles.amountDescriptionBlock}
          >
            <SSHStack gap="xs" style={styles.amountFiatRow}>
              <SSText center weight="medium" size="2xl">
                {privacyMode
                  ? '•••• sats'
                  : `${amountSats.toLocaleString('en-US')} sats`}
              </SSText>
              <SSText center color="muted" size="lg">
                {privacyMode
                  ? `≈ •••• ${fiatCurrency}`
                  : `≈ ${satsToFiat(amountSats).toLocaleString('en-US', {
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2
                    })} ${fiatCurrency}`}
              </SSText>
            </SSHStack>
            {decodedInvoice.description ? (
              <SSText center size="lg" style={styles.description}>
                {decodedInvoice.description}
              </SSText>
            ) : null}
          </SSVStack>
          {showCreated && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.paymentDetails.created')}
              </SSText>
              <SSVStack
                gap="xs"
                style={[styles.detailValue, styles.datetimeColumn]}
              >
                <SSText style={styles.datetimePrimary}>
                  {formatCreatedRelative(createdAt.getTime(), nowMs)}
                </SSText>
                <SSText color="muted" size="sm" style={styles.datetimeMuted}>
                  {t('lightning.paymentDetails.absoluteDateTime', {
                    datePart: createdAbsolute.datePart,
                    timePart: createdAbsolute.timePart
                  })}
                </SSText>
              </SSVStack>
            </SSHStack>
          )}
          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('lightning.paymentDetails.expires')}
            </SSText>
            <SSVStack
              gap="xs"
              style={[styles.detailValue, styles.datetimeColumn]}
            >
              <SSText style={styles.datetimePrimary}>
                {formatExpiresRelative(expiresAt.getTime(), nowMs)}
              </SSText>
              <SSText color="muted" size="sm" style={styles.datetimeMuted}>
                {t('lightning.paymentDetails.absoluteDateTime', {
                  datePart: expiresAbsolute.datePart,
                  timePart: expiresAbsolute.timePart
                })}
              </SSText>
            </SSVStack>
          </SSHStack>
        </View>
        {showPaymentHash && (
          <View style={styles.detailSection}>
            <SSHStack gap="xs" style={[styles.detailRow, styles.hashRow]}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.paymentDetails.paymentHash')}
              </SSText>
              <View style={styles.hashContainer}>
                <SSClipboardCopy
                  fullWidth
                  text={decodedInvoice.payment_hash}
                  style={styles.hashClipboard}
                >
                  <SSText
                    size="sm"
                    style={[styles.hashText, styles.monospaceInput]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {decodedInvoice.payment_hash}
                  </SSText>
                </SSClipboardCopy>
              </View>
            </SSHStack>
          </View>
        )}
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  amountDescriptionBlock: {
    marginBottom: 4
  },
  amountFiatRow: {
    alignItems: 'baseline',
    alignSelf: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '100%'
  },
  datetimeColumn: {
    alignItems: 'flex-end'
  },
  datetimeMuted: {
    textAlign: 'right'
  },
  datetimePrimary: {
    textAlign: 'right'
  },
  description: {
    paddingBottom: 16,
    paddingHorizontal: 8
  },
  detailLabel: {
    fontSize: 14,
    minWidth: 100
  },
  detailRow: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  detailSection: {
    gap: 12
  },
  detailValue: {
    flex: 1,
    textAlign: 'right'
  },
  detailsContent: {
    gap: 16
  },
  hashClipboard: {
    minWidth: 0
  },
  hashContainer: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0
  },
  hashRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  hashText: {
    fontFamily: Typography.sfProMono,
    fontSize: 12,
    opacity: 0.8,
    textAlign: 'right'
  },
  invoiceDetails: {
    marginBottom: 16,
    marginTop: 16
  },
  monospaceInput: {
    fontFamily: Typography.sfProMono,
    fontSize: 14,
    letterSpacing: 0.5
  }
})

export default SSPaymentDetails
