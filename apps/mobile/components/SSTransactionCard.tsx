import { Image } from 'expo-image'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { formatAddress, formatNumber } from '@/utils/format'

import SSText from './SSText'

type SSTransactionCardProps = {
  transaction: Transaction
  blockHeight: number
}

export default function SSTransactionCard({
  transaction,
  blockHeight
}: SSTransactionCardProps) {
  return (
    <SSHStack style={{ paddingVertical: 16, alignItems: 'flex-start' }}>
      {transaction.type === 'receive' && (
        <Image
          style={{ width: 19, height: 19 }}
          source={require('@/assets/icons/incoming.svg')}
        />
      )}
      {transaction.type === 'send' && (
        <Image
          style={{ width: 19, height: 19 }}
          source={require('@/assets/icons/outgoing.svg')}
        />
      )}
      <SSHStack>
        <SSVStack gap="xs">
          <SSText color="muted">11:51am - Mar 28, 2024</SSText>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl">
              {formatNumber(
                transaction.type === 'receive'
                  ? transaction.received
                  : -transaction.sent
              )}
            </SSText>
            <SSText color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSText style={{ color: Colors.gray[400] }}>0.73 USD</SSText>
        </SSVStack>
        <SSVStack>
          <SSText style={{ textAlign: 'right' }}>1k+ blocks deep</SSText>
          <SSVStack gap="xs">
            <SSText size="md" style={{ textAlign: 'right' }} numberOfLines={1}>
              {transaction.memo || i18n.t('account.noMemo')}
            </SSText>
            <SSHStack gap="xs">
              <SSText color="muted">{i18n.t('common.to').toLowerCase()}</SSText>
              <SSText>{formatAddress(transaction.address || '')}</SSText>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSHStack>
    </SSHStack>
  )
}
