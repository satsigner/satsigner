import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import type { Currency } from '@/types/models/Blockchain'
import type { Transaction } from '@/types/models/Transaction'
import {
  formatConfirmations,
  formatFiatPrice,
  formatLabel,
  formatNumber,
  formatPercentualChange
} from '@/utils/format'

import { SSIconIncoming, SSIconOutgoing } from './icons'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'
import { useAccountsStore } from '@/store/accounts'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import SSStyledSatText from './SSStyledSatText'

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
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const { type, received, sent, prices } = transaction
  const amount = type === 'receive' ? received : sent - received

  const [account, padding] = useAccountsStore((state) => [
    state.accounts.find((account) => account.name === id),
    state.padding
  ])

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
          alignItems: 'stretch',
          paddingHorizontal: 16,
          paddingTop: 8
        }}
      >
        <SSVStack gap="none">
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
              <SSStyledSatText
                amount={amount}
                decimals={0}
                padding={padding}
                type={transaction.type}
                noColor={false}
              />
              <SSText color="muted">
                {i18n.t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
          </SSHStack>
          <SSText style={{ color: Colors.gray[400] }}>{priceDisplay}</SSText>
          <SSText
            size="md"
            style={[
              { textAlign: 'left' },
              !transaction.label && { color: Colors.gray[100] }
            ]}
            numberOfLines={1}
          >
            {formatLabel(transaction.label || i18n.t('account.noMemo')).label}
          </SSText>
        </SSVStack>
        <SSVStack justifyBetween>
          <SSText style={[{ textAlign: 'right' }, getConfirmationsColor()]}>
            {formatConfirmations(confirmations)}
          </SSText>

          <SSText color="muted" style={[{ textAlign: 'right' }]}>
            <SSStyledSatText
              amount={account?.summary.balance || 0}
              decimals={0}
              padding={padding}
              type={transaction.type}
              textSize="sm"
            />
          </SSText>
          <SSVStack gap="xs">
            <SSHStack gap="xs" style={{ alignSelf: 'flex-end' }}>
              {transaction.label ? (
                formatLabel(transaction.label).tags.map((tag, index) => (
                  <SSText
                    key={index}
                    size="xs"
                    style={[
                      { textAlign: 'right' },
                      {
                        backgroundColor: Colors.gray[700],
                        paddingVertical: 2,
                        paddingHorizontal: 4,
                        borderRadius: 4,
                        marginHorizontal: 2
                      }
                    ]}
                    uppercase
                    numberOfLines={1}
                  >
                    {tag}
                  </SSText>
                ))
              ) : (
                <SSText
                  size="xs"
                  style={[
                    { textAlign: 'right', color: Colors.gray[100] },
                    {
                      backgroundColor: Colors.gray[700],
                      paddingVertical: 2,
                      paddingHorizontal: 4,
                      borderRadius: 4
                    }
                  ]}
                  uppercase
                  numberOfLines={1}
                >
                  {i18n.t('account.noTags')}
                </SSText>
              )}
            </SSHStack>
          </SSVStack>
        </SSVStack>
      </SSHStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  unconfirmed: {
    color: Colors.error
  },
  confirmedFew: {
    color: Colors.warning
  },
  confirmedEnough: {
    color: Colors.success
  }
})
