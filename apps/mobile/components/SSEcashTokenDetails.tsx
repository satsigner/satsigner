import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type EcashToken } from '@/types/models/Ecash'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import { satsToFiat } from '@/utils/fiat'
import { formatNumber } from '@/utils/format'

type SSEcashTokenDetailsProps = Pick<
  DisplayPreferences,
  'btcPrice' | 'fiatEnabled'
> & {
  decodedToken: EcashToken
  fiatCurrency: string
  privacyMode?: boolean
  showMint?: boolean
  showProofs?: boolean
}

function SSEcashTokenDetails({
  decodedToken,
  fiatCurrency,
  privacyMode = false,
  btcPrice,
  fiatEnabled,
  showMint = true,
  showProofs = true
}: SSEcashTokenDetailsProps) {
  const { amount: totalAmount, proofAmounts } = decodedToken

  return (
    <SSVStack gap="sm" style={styles.tokenDetails}>
      <SSText uppercase>{t('ecash.tokenDetails.title')}</SSText>
      <View style={styles.detailsContent}>
        <View style={styles.detailSection}>
          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('ecash.tokenDetails.amount')}
            </SSText>
            <SSHStack gap="xs" style={styles.amountContainer}>
              <SSText weight="medium">
                {privacyMode ? '•••• sats' : `${totalAmount} sats`}
              </SSText>
              <SSText color="muted" size="sm">
                {privacyMode
                  ? `≈ •••• ${fiatCurrency}`
                  : `≈ ${formatNumber(satsToFiat(totalAmount, btcPrice, fiatEnabled), 2)} ${fiatCurrency}`}
              </SSText>
            </SSHStack>
          </SSHStack>
          {decodedToken.memo && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('ecash.tokenDetails.memo')}
              </SSText>
              <SSText style={styles.detailValue}>{decodedToken.memo}</SSText>
            </SSHStack>
          )}
          {showMint && (
            <SSHStack gap="xs" style={styles.detailRow}>
              <SSText color="muted" style={styles.detailLabel}>
                {t('ecash.tokenDetails.mint')}
              </SSText>
              <SSText
                style={styles.detailValue}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {decodedToken.mint}
              </SSText>
            </SSHStack>
          )}

          <SSHStack gap="xs" style={styles.detailRow}>
            <SSText color="muted" style={styles.detailLabel}>
              {t('ecash.tokenDetails.proofs')}
            </SSText>
            <SSText style={styles.detailValue}>
              {proofAmounts.length}{' '}
              {proofAmounts.length === 1
                ? t('ecash.tokenDetails.proofsCountSingular')
                : t('ecash.tokenDetails.proofsCount')}
            </SSText>
          </SSHStack>
        </View>

        {showProofs && proofAmounts.length > 0 && (
          <View style={styles.detailSection}>
            <SSText uppercase>{t('ecash.tokenDetails.proofDetails')}</SSText>
            {proofAmounts.slice(0, 3).map((proofAmount, index) => (
              <SSHStack
                key={index}
                gap="xs"
                style={[styles.detailRow, styles.proofRow]}
              >
                <SSText color="muted" style={styles.detailLabel}>
                  {t('ecash.tokenDetails.proof')} {index + 1}
                </SSText>
                <SSHStack gap="xs" style={styles.proofContainer}>
                  <SSText weight="medium" size="sm">
                    {privacyMode ? '•••• sats' : `${proofAmount} sats`}
                  </SSText>
                </SSHStack>
              </SSHStack>
            ))}
            {proofAmounts.length > 3 && (
              <SSText color="muted" size="sm">
                {t('ecash.tokenDetails.andMore', {
                  count: proofAmounts.length - 3
                })}
              </SSText>
            )}
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
  proofContainer: {
    alignItems: 'baseline',
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end'
  },
  proofRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  tokenDetails: {
    marginBottom: 16,
    marginTop: 16
  }
})

export default SSEcashTokenDetails
