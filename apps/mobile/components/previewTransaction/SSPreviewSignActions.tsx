import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'

type SSPreviewSignActionsProps = {
  account: Account
  canShareWithGroup: boolean
  collectedSignatures: number
  isSignDisabled: boolean
  onShareWithGroup: () => void
  onSign: () => void
}

// Sign button for accounts holding keys, with the multisig signature count.
function SSPreviewSignActions({
  account,
  canShareWithGroup,
  collectedSignatures,
  isSignDisabled,
  onShareWithGroup,
  onSign
}: SSPreviewSignActionsProps) {
  if (account.policyType === 'watchonly' || account.keys.length === 0) {
    return null
  }

  const isMultisig = account.policyType === 'multisig'

  return (
    <>
      {isMultisig && (
        <SSText center color="muted" size="sm" style={styles.signaturesCount}>
          {t('transaction.preview.signaturesCollected')}: {collectedSignatures}{' '}
          / {account.keysRequired || account.keys.length}
        </SSText>
      )}
      <SSButton
        variant="secondary"
        disabled={isSignDisabled}
        label={
          isMultisig
            ? t('transaction.preview.checkAllSignatures')
            : t('sign.transaction')
        }
        onPress={onSign}
      />
      {canShareWithGroup && (
        <SSButton
          variant="ghost"
          label={t('account.nostrSync.shareWithGroup')}
          onPress={onShareWithGroup}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  signaturesCount: { marginBottom: 8 }
})

export default SSPreviewSignActions
