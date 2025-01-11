import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import {
  formatAddress,
  formatFiatPrice,
  formatLabel,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'

import { SSIconIncoming, SSIconOutgoing } from './icons'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'
import { useRouter } from 'expo-router'

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

  const [priceDisplay, setPriceDisplay] = useState('')

  const { type, received, sent, prices } = transaction
  const amount = type === 'receive' ? received : sent

  useEffect(() => {
    const itemsToDisplay = []

    const oldPrice = prices ? prices[fiatCurrency] : null

    if (btcPrice) itemsToDisplay.push(formatFiatPrice(amount, btcPrice))

    if (prices[fiatCurrency])
      itemsToDisplay.push(
        '(' + formatFiatPrice(amount, prices[fiatCurrency]) + ')'
      )

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
            {getConfirmationsText()}
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
              {formatLabel(
                transaction.label || i18n.t('account.noLabel')
              ).label}
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
