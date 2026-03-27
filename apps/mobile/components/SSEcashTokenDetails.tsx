import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Typography } from '@/styles'
import { type EcashToken } from '@/types/models/Ecash'
import { formatNumber } from '@/utils/format'

type SSEcashTokenDetailsProps = {
  decodedToken: EcashToken
  showMint?: boolean
  showProofs?: boolean
  fiatCurrency: string
  satsToFiat: (amount: number) => number
}

function SSEcashTokenDetails({
  decodedToken,
  showMint = true,
  showProofs = true,
  fiatCurrency,
  satsToFiat
}: SSEcashTokenDetailsProps) {
  const totalAmount = decodedToken.proofs.reduce(
    (sum, proof) => sum + proof.amount,
    0
  )

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
              <SSText weight="medium">{totalAmount} sats</SSText>
              <SSText color="muted" size="sm">
                {`≈ ${formatNumber(satsToFiat(totalAmount), 2)} ${fiatCurrency}`}
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
              {decodedToken.proofs.length} {t('ecash.tokenDetails.proofsCount')}
            </SSText>
          </SSHStack>
        </View>

        {showProofs && decodedToken.proofs.length > 0 && (
          <View style={styles.detailSection}>
            <SSText uppercase>{t('ecash.tokenDetails.proofDetails')}</SSText>
            {decodedToken.proofs.slice(0, 3).map((proof, index) => (
              <SSHStack
                key={`${proof.id}-${index}`}
                gap="xs"
                style={[styles.detailRow, styles.proofRow]}
              >
                <SSText color="muted" style={styles.detailLabel}>
                  {t('ecash.tokenDetails.proof')} {index + 1}
                </SSText>
                <SSHStack gap="xs" style={styles.proofContainer}>
                  <SSText weight="medium" size="sm">
                    {proof.amount} sats
                  </SSText>
                  <SSText
                    size="xs"
                    style={[styles.proofId, styles.monospaceInput]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {proof.id}
                  </SSText>
                </SSHStack>
              </SSHStack>
            ))}
            {decodedToken.proofs.length > 3 && (
              <SSText color="muted" size="sm">
                {t('ecash.tokenDetails.andMore', {
                  count: decodedToken.proofs.length - 3
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
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'baseline'
  },
  detailLabel: {
    minWidth: 100,
    fontSize: 14
  },
  detailRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap'
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
  monospaceInput: {
    fontFamily: Typography.sfProMono,
    fontSize: 14,
    letterSpacing: 0.5
  },
  proofContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'baseline',
    gap: 8
  },
  proofId: {
    opacity: 0.8,
    fontSize: 10,
    fontFamily: Typography.sfProMono
  },
  proofRow: {
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  tokenDetails: {
    marginTop: 16,
    marginBottom: 16
  }
})

export default SSEcashTokenDetails
