import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSQuoteStatusProps = {
  status: string
  onCheck?: () => void
  isLoading?: boolean
  showCheckButton?: boolean
}

function SSQuoteStatus({
  status,
  onCheck,
  isLoading = false,
  showCheckButton = true
}: SSQuoteStatusProps) {
  function getStatusColor(status: string) {
    switch (status) {
      case 'PENDING':
        return '#FFA500'
      case 'PAID':
        return '#00FF00'
      case 'EXPIRED':
        return '#FF0000'
      case 'CANCELLED':
        return '#FF0000'
      default:
        return '#FFFFFF'
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'PENDING':
        return t('ecash.quote.pending')
      case 'PAID':
        return t('ecash.quote.paid')
      case 'EXPIRED':
        return t('ecash.quote.expired')
      case 'CANCELLED':
        return t('ecash.quote.cancelled')
      default:
        return ''
    }
  }

  return (
    <SSVStack gap="sm">
      <SSVStack gap="xs">
        <SSText color="muted" uppercase>
          {t('ecash.quote.status')}
        </SSText>
        <SSText style={{ color: getStatusColor(status) }}>
          {getStatusText(status)}
        </SSText>
      </SSVStack>

      {status === 'PENDING' && showCheckButton && onCheck && (
        <SSButton
          label={t('ecash.quote.check')}
          onPress={onCheck}
          loading={isLoading}
          variant="outline"
        />
      )}
    </SSVStack>
  )
}

export default SSQuoteStatus
