import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Typography } from '@/styles'
import { formatNumber } from '@/utils/format'

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
  showCreated?: boolean
  showPaymentHash?: boolean
  fiatCurrency: string
  satsToFiat: (amount: number) => number
}

function SSPaymentDetails({
  decodedInvoice,
  showCreated = true,
  showPaymentHash = true,
  fiatCurrency,
  satsToFiat
}: SSPaymentDetailsProps) {
  return (
    <SSVStack gap="sm" style={styles.invoiceDetails}>
      <SSText uppercase>{t('lightning.paymentDetails.title')}</SSText>

      <View style={styles.detailsContent}>
        <View style={styles.detailSection}>
          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('lightning.paymentDetails.amount')}
            </SSText>
            <SSHStack gap="xs" style={styles.amountContainer}>
              <SSText weight="medium">
                {decodedInvoice.num_satoshis} sats
              </SSText>
              <SSText color="muted" size="sm">
                ≈{' '}
                {formatNumber(
                  satsToFiat(Number(decodedInvoice.num_satoshis)),
                  2
                )}{' '}
                {fiatCurrency}
              </SSText>
            </SSHStack>
          </SSHStack>
          {decodedInvoice.description && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.paymentDetails.description')}
              </SSText>
              <SSText style={styles.detailValue}>
                {decodedInvoice.description}
              </SSText>
            </SSHStack>
          )}
          {showCreated && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.paymentDetails.created')}
              </SSText>
              <SSText style={styles.detailValue}>
                {new Date(
                  Number(decodedInvoice.timestamp) * 1000
                ).toLocaleString('en-US', {
                  day: 'numeric',
                  hour: '2-digit',
                  hour12: true,
                  minute: '2-digit',
                  month: 'long',
                  second: '2-digit',
                  year: 'numeric'
                })}
              </SSText>
            </SSHStack>
          )}
          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('lightning.paymentDetails.expires')}
            </SSText>
            <SSText style={styles.detailValue}>
              {new Date(
                Number(decodedInvoice.timestamp) * 1000 +
                  Number(decodedInvoice.expiry) * 1000
              ).toLocaleString('en-US', {
                day: 'numeric',
                hour: '2-digit',
                hour12: true,
                minute: '2-digit',
                month: 'long',
                second: '2-digit',
                year: 'numeric'
              })}
            </SSText>
          </SSHStack>
        </View>
        {showPaymentHash && (
          <View style={styles.detailSection}>
            <SSHStack gap="xs" style={[styles.detailRow, styles.hashRow]}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.paymentDetails.paymentHash')}
              </SSText>
              <View style={styles.hashContainer}>
                <SSText
                  size="sm"
                  style={[styles.hashText, styles.monospaceInput]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {decodedInvoice.payment_hash}
                </SSText>
              </View>
            </SSHStack>
          </View>
        )}
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  amountContainer: {
    alignItems: 'baseline',
    flex: 1,
    justifyContent: 'flex-end'
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
