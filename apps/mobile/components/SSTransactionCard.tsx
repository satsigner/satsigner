import { Image } from 'expo-image'
import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { formatAddress, formatNumber } from '@/utils/format'

import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'

type SSTransactionCardProps = {
  transaction: Transaction
  blockHeight: number
}

export default function SSTransactionCard({
  transaction,
  blockHeight
}: SSTransactionCardProps) {
  const priceStore = usePriceStore()

  const confirmations = transaction.blockHeight
    ? blockHeight - transaction.blockHeight + 1
    : 0

  function getConfirmationsText() {
    if (confirmations <= 0) return i18n.t('bitcoin.confirmations.unconfirmed')
    else if (confirmations === 1)
      return `1 ${i18n.t('bitcoin.confirmations.oneBlock').toLowerCase()}`
    else if (confirmations < 6)
      return `${confirmations} ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else if (confirmations < 10)
      return `6+ ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else if (confirmations < 100)
      return `10+ ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else if (confirmations < 1_000)
      return `100+ ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else if (confirmations < 10_000)
      return `1k+ ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else if (confirmations < 100_000)
      return `10k+ ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
    else
      return `100k ${i18n.t('bitcoin.confirmations.manyBlocks').toLowerCase()}`
  }

  function getConfirmationsColor() {
    if (confirmations <= 0) return styles.unconfirmed
    else if (confirmations < 6) return styles.confirmedFew
    else return styles.confirmedEnough
  }

  return (
    <SSHStack
      style={{
        paddingTop: 8,
        alignItems: 'flex-start'
      }}
    >
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
      <SSHStack justifyBetween style={{ flex: 1 }}>
        <SSVStack gap="xs">
          <SSText color="muted">
            {transaction.timestamp && (
              <SSTimeAgoText date={new Date(transaction.timestamp)} />
            )}
          </SSText>
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
          <SSText style={{ color: Colors.gray[400] }}>
            {formatNumber(
              priceStore.satsToFiat(
                transaction.type === 'receive'
                  ? transaction.received
                  : -transaction.sent
              ),
              2
            )}{' '}
            {priceStore.fiatCurrency}
          </SSText>
        </SSVStack>
        <SSVStack>
          <SSText style={[{ textAlign: 'right' }, getConfirmationsColor()]}>
            {getConfirmationsText()}
          </SSText>
          <SSVStack gap="xs">
            <SSText
              size="md"
              style={[
                { textAlign: 'right' },
                !transaction.memo && { color: Colors.gray[100] }
              ]}
              numberOfLines={1}
            >
              {transaction.memo || i18n.t('account.noMemo')}
            </SSText>
            <SSHStack gap="xs">
              <SSText color="muted">
                {transaction.address && i18n.t('common.to').toLowerCase()}
              </SSText>
              <SSText>
                {transaction.address &&
                  formatAddress(transaction.address || '')}
              </SSText>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSHStack>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  unconfirmed: {
    color: Colors.white
  },
  confirmedFew: {
    color: Colors.warning
  },
  confirmedEnough: {
    color: Colors.success
  }
})
