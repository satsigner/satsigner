import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ChatInvoice } from '@/utils/chatPaymentRequests'
import { formatMaskedSats } from '@/utils/format'

const INVOICE_PREVIEW_CHARS = 14

type SSChatInvoiceCardProps = {
  invoice: ChatInvoice
  expired: boolean
  /** The invoice is for another network than the app is on. */
  wrongNetwork: boolean
  /** No wallet that can pay is set up. */
  canPay: boolean
  privacyMode: boolean
  onPay: (invoice: ChatInvoice) => void
  onCopy: (invoice: string) => void
}

function shortenInvoice(invoice: string): string {
  return `${invoice.slice(0, INVOICE_PREVIEW_CHARS)}…${invoice.slice(-INVOICE_PREVIEW_CHARS)}`
}

function SSChatInvoiceCard({
  invoice,
  expired,
  wrongNetwork,
  canPay,
  privacyMode,
  onPay,
  onCopy
}: SSChatInvoiceCardProps) {
  function handlePay() {
    onPay(invoice)
  }

  function handleCopy() {
    onCopy(invoice.invoice)
  }

  const amountLabel =
    invoice.amountSats > 0
      ? formatMaskedSats(invoice.amountSats, privacyMode)
      : t('nostrIdentity.chat.invoice.anyAmount')

  return (
    <View style={styles.card}>
      <SSVStack gap="xs">
        <SSHStack style={styles.header}>
          <SSText size="xs" color="muted" uppercase>
            {t('nostrIdentity.chat.invoice.title')}
          </SSText>
          {expired ? (
            <SSText size="xs" style={styles.warning}>
              {t('nostrIdentity.chat.invoice.expired')}
            </SSText>
          ) : null}
        </SSHStack>
        <SSText size="lg" weight="medium">
          {amountLabel}
        </SSText>
        {invoice.description ? (
          <SSText size="sm" color="muted" numberOfLines={3}>
            {invoice.description}
          </SSText>
        ) : null}
        <SSText size="xxs" color="muted" type="mono" numberOfLines={1}>
          {shortenInvoice(invoice.invoice)}
        </SSText>
        {wrongNetwork ? (
          <SSText size="xs" style={styles.warning}>
            {t('nostrIdentity.chat.invoice.wrongNetwork')}
          </SSText>
        ) : null}
        <SSHStack gap="sm">
          <View style={styles.button}>
            <SSButton
              label={t('nostrIdentity.chat.invoice.pay')}
              onPress={handlePay}
              disabled={expired || wrongNetwork || !canPay}
            />
          </View>
          <View style={styles.button}>
            <SSButton
              label={t('common.copy')}
              onPress={handleCopy}
              variant="outline"
            />
          </View>
        </SSHStack>
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    flex: 1
  },
  card: {
    backgroundColor: Colors.gray[925],
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    marginTop: 6,
    padding: 12
  },
  header: {
    justifyContent: 'space-between'
  },
  warning: {
    color: Colors.warning
  }
})

export default SSChatInvoiceCard
