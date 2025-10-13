import { StyleSheet, TextInput } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { formatNumber } from '@/utils/format'

type LNURLPayResponse = {
  callback: string
  maxSendable: number
  minSendable: number
  metadata: string
  tag: 'payRequest'
  commentAllowed?: number
  nostrPubkey?: string
  allowsNostr?: boolean
}

type SSLNURLDetailsProps = {
  lnurlDetails: LNURLPayResponse | null
  isFetching: boolean
  showCommentInfo?: boolean
  amount: string
  onAmountChange: (amount: string) => void
  comment?: string
  onCommentChange?: (comment: string) => void
  inputStyles?: Record<string, unknown>
  fiatCurrency: string
  satsToFiat: (amount: number) => number
}

function extractServiceName(metadata: string): string {
  try {
    const parsed = JSON.parse(metadata)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const firstEntry = parsed[0]
      if (Array.isArray(firstEntry) && firstEntry.length > 1) {
        return firstEntry[1] // Service name is usually the second element
      }
    }
    return 'Unknown Service'
  } catch {
    return 'Unknown Service'
  }
}

function SSLNURLDetails({
  lnurlDetails,
  isFetching,
  showCommentInfo = false,
  amount,
  onAmountChange,
  comment,
  onCommentChange,
  inputStyles,
  fiatCurrency,
  satsToFiat
}: SSLNURLDetailsProps) {
  if (!lnurlDetails && !isFetching) {
    return null
  }

  return (
    <SSVStack gap="sm" style={styles.lnurlDetails}>
      <SSText uppercase>{t('lightning.lnurlDetails.title')}</SSText>
      {isFetching ? (
        <SSHStack gap="sm" style={styles.loadingRow}>
          <SSText color="muted" size="sm">
            {t('lightning.lnurlDetails.loading')}
          </SSText>
        </SSHStack>
      ) : lnurlDetails ? (
        <>
          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('lightning.lnurlDetails.service')}
            </SSText>
            <SSText style={styles.detailValue}>
              {extractServiceName(lnurlDetails.metadata)}
            </SSText>
          </SSHStack>

          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('lightning.lnurlDetails.amountRange')}
            </SSText>
            <SSText style={styles.detailValue}>
              {Math.ceil(lnurlDetails.minSendable / 1000)} -{' '}
              {Math.floor(lnurlDetails.maxSendable / 1000)} sats
            </SSText>
          </SSHStack>

          {showCommentInfo && lnurlDetails.commentAllowed && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('lightning.lnurlDetails.commentAllowed')}
              </SSText>
              <SSText style={styles.detailValue}>
                {lnurlDetails.commentAllowed} characters
              </SSText>
            </SSHStack>
          )}

          {/* Amount Input */}
          <SSVStack gap="xs">
            <SSText color="muted">Amount (sats)</SSText>
            <TextInput
              style={[styles.input, inputStyles]}
              value={amount}
              onChangeText={onAmountChange}
              placeholder="Enter amount in sats"
              placeholderTextColor="#666"
              keyboardType="numeric"
              editable={!isFetching}
            />
            {amount && !isNaN(Number(amount)) && (
              <SSHStack gap="xs" style={styles.fiatAmount}>
                <SSText color="muted" size="sm">
                  ≈ {formatNumber(satsToFiat(Number(amount)), 2)} {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
          </SSVStack>
          {onCommentChange && (
            <SSVStack gap="xs">
              <SSText color="muted">Comment (optional)</SSText>
              <TextInput
                style={[styles.input, inputStyles]}
                value={comment || ''}
                onChangeText={onCommentChange}
                placeholder="Enter comment"
                placeholderTextColor="#666"
                editable={!isFetching}
              />
            </SSVStack>
          )}
        </>
      ) : (
        <SSHStack gap="sm" style={styles.errorRow}>
          <SSText color="muted" size="sm">
            {t('lightning.lnurlDetails.error')}
          </SSText>
        </SSHStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  lnurlDetails: {
    marginTop: 16,
    marginBottom: 16
  },
  detailRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
  },
  detailLabel: {
    minWidth: 100,
    fontSize: 14
  },
  detailValue: {
    flex: 1,
    textAlign: 'right'
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  errorRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16
  },
  input: {
    backgroundColor: '#242424',
    borderRadius: 3,
    padding: 12,
    color: 'white',
    fontSize: 16
  },
  fiatAmount: {
    marginTop: 4,
    marginLeft: 4
  }
})

export default SSLNURLDetails
