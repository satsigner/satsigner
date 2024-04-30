import { Image } from 'expo-image'
import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { formatAddress } from '@/utils/format'

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
        <SSVStack>
          <SSText>11:51am - Mar 28, 2024</SSText>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl">
              {transaction.type === 'receive'
                ? transaction.received
                : -transaction.sent}
            </SSText>
            <SSText>{i18n.t('bitcoin.sats').toLowerCase()}</SSText>
          </SSHStack>
          <SSText>0.73 USD</SSText>
        </SSVStack>
        <SSVStack>
          <SSText>1k+ blocks deep</SSText>
          <SSText>{transaction.memo || i18n.t('account.noMemo')}</SSText>
          <SSHStack gap="xxs">
            <SSText>{i18n.t('common.to').toLowerCase()}</SSText>
            <SSText>{formatAddress(transaction.address || '')}</SSText>
          </SSHStack>
        </SSVStack>
      </SSHStack>
    </SSHStack>
  )
}
