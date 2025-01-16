import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import type { Currency } from '@/types/models/Blockchain'
import type { Transaction } from '@/types/models/Transaction'
import {
  formatAddress,
  formatConfirmations,
  formatFiatPrice,
  formatLabel,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'

import { SSIconIncoming, SSIconOutgoing } from './icons'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'

type SSTransactionCardProps = {
  transaction: Transaction
  blockHeight: number
  fiatCurrency: Currency
  btcPrice: number
  link: string
}

export default function SSTransactionCard({
  transaction,
  blockHeight,
  fiatCurrency,
  btcPrice,
  link
}: SSTransactionCardProps) {
  const confirmations = transaction.blockHeight
    ? blockHeight - transaction.blockHeight + 1
    : 0

  function getConfirmationsColor() {
    if (confirmations <= 0) return styles.unconfirmed
    else if (confirmations < 6) return styles.confirmedFew
    else return styles.confirmedEnough
  }

  const [priceDisplay, setPriceDisplay] = useState('')

  const { type, received, sent, prices } = transaction
  const amount = type === 'receive' ? received : sent

  useEffect(() => {
    const itemsToDisplay: string[] = []

    const oldPrice = prices ? prices[fiatCurrency] : null

    if (btcPrice) itemsToDisplay.push(formatFiatPrice(amount, btcPrice))

    if (prices && prices[fiatCurrency]) {
      itemsToDisplay.push(
        '(' + formatFiatPrice(amount, prices[fiatCurrency] || 0) + ')'
      )
    }

    if (btcPrice || oldPrice) itemsToDisplay.push(fiatCurrency)

    if (btcPrice && oldPrice)
      itemsToDisplay.push(formatPercentualChange(btcPrice, oldPrice))

    setPriceDisplay(itemsToDisplay.join(' '))
  }, [btcPrice, fiatCurrency, amount, prices])

  const router = useRouter()

  return (
    <TouchableOpacity onPress={() => router.navigate(link)}>
      <SSHStack
        justifyBetween
        style={{
          flex: 1,
          alignItems: 'stretch'
        }}
      >
        <SSVStack gap="xs">
          <SSText color="muted">
            {transaction.timestamp && (
              <SSTimeAgoText date={new Date(transaction.timestamp)} />
            )}
          </SSText>
          <SSHStack>
            {transaction.type === 'receive' && (
              <SSIconIncoming height={19} width={19} />
            )}
            {transaction.type === 'send' && (
              <SSIconOutgoing height={19} width={19} />
            )}
            <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
              <SSText size="3xl">{formatNumber(amount)}</SSText>
              <SSText color="muted">
                {i18n.t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
          </SSHStack>
          <SSText style={{ color: Colors.gray[400] }}>{priceDisplay}</SSText>
        </SSVStack>
        <SSVStack justifyBetween>
          <SSText style={[{ textAlign: 'right' }, getConfirmationsColor()]}>
            {formatConfirmations(confirmations)}
          </SSText>
          <SSVStack gap="xs">
            <SSText
              size="md"
              style={[
                { textAlign: 'right' },
                !transaction.label && { color: Colors.gray[100] }
              ]}
              numberOfLines={1}
            >
              {
                formatLabel(transaction.label || i18n.t('account.noLabel'))
                  .label
              }
            </SSText>
            <SSHStack gap="xs" style={{ alignSelf: 'flex-end' }}>
              <SSText color="muted">
                {transaction.address && transaction.type === 'receive'
                  ? i18n.t('common.from').toLowerCase()
                  : i18n.t('common.to').toLowerCase()}
              </SSText>
              <SSText>
                {transaction.address &&
                  formatAddress(transaction.address || '')}
              </SSText>
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSHStack>
    </TouchableOpacity>
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
