import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type PayjoinInvoice } from '@/types/payjoin'
import { formatPayjoinSummary } from '@/utils/payjoinInvoice'

type SSPreviewPayjoinNoteProps = {
  invoice: PayjoinInvoice | undefined
  expiryLabel: string | null
}

function SSPreviewPayjoinNote({
  invoice,
  expiryLabel
}: SSPreviewPayjoinNoteProps) {
  if (!invoice) {
    return null
  }

  return (
    <View style={styles.payjoinNote} testID="preview-payjoin-note">
      <SSText size="xs" uppercase color="muted" center>
        {t('transaction.build.payjoin.previewNote.title')}
      </SSText>
      <SSText size="sm" weight="light" center>
        {formatPayjoinSummary(invoice, expiryLabel)}
      </SSText>
      <SSText size="xs" center style={styles.payjoinNoteHint}>
        {t('transaction.build.payjoin.previewNote.hint')}
      </SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  payjoinNote: {
    gap: 4,
    paddingVertical: 4
  },
  payjoinNoteHint: {
    color: Colors.gray[500]
  }
})

export default SSPreviewPayjoinNote
