import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle
} from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import {
  formatConfirmations,
  formatFiatPrice,
  formatPercentualChange
} from '@/utils/format'
import { parseLabel } from '@/utils/parse'

import { SSIconIncoming, SSIconOutgoing } from './icons'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'

type SSTransactionCardProps = {
  transaction: Transaction
  blockHeight: number
  fiatCurrency: Currency
  btcPrice: number
  walletBalance?: number
  link: string
  expand: boolean
  style?: StyleProp<ViewStyle>
}

function SSTransactionCard({
  transaction,
  blockHeight,
  fiatCurrency,
  btcPrice,
  walletBalance,
  link,
  expand,
  style = {}
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
  const [percentChange, setPercentChange] = useState('')

  const { type, received, sent, prices } = transaction
  const amount = type === 'receive' ? received : sent - received

  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

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
      setPercentChange(formatPercentualChange(btcPrice, oldPrice))

    setPriceDisplay(itemsToDisplay.join(' '))
  }, [btcPrice, fiatCurrency, amount, prices])

  const router = useRouter()

  return (
    <TouchableOpacity onPress={() => router.navigate(link)}>
      <SSVStack
        style={[
          {
            paddingHorizontal: 0,
            paddingTop: expand ? 0 : 4,
            paddingBottom: expand ? 6 : 12
          },
          style
        ]}
        gap="none"
      >
        <SSHStack justifyBetween style={{ height: 18 }}>
          <SSText color="muted">
            {transaction.timestamp && (
              <SSTimeAgoText date={new Date(transaction.timestamp)} />
            )}
          </SSText>
          <SSText style={[{ textAlign: 'right' }, getConfirmationsColor()]}>
            {formatConfirmations(confirmations)}
          </SSText>
        </SSHStack>
        <SSVStack gap="none">
          <SSHStack
            gap={expand ? 'xs' : 'sm'}
            style={{
              height: expand ? 24 : 42,
              marginTop: expand ? 0 : -4
            }}
          >
            {transaction.type === 'receive' && (
              <SSHStack style={{ marginTop: expand ? 4 : 12 }}>
                <SSIconIncoming
                  height={expand ? 12 : 21}
                  width={expand ? 12 : 21}
                />
              </SSHStack>
            )}
            {transaction.type === 'send' && (
              <SSHStack style={{ marginTop: expand ? 4 : 12 }}>
                <SSIconOutgoing
                  height={expand ? 12 : 21}
                  width={expand ? 12 : 21}
                />
              </SSHStack>
            )}
            <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
              <SSStyledSatText
                amount={amount}
                decimals={0}
                useZeroPadding={useZeroPadding}
                type={transaction.type}
                textSize={expand ? 'xl' : '4xl'}
                noColor={false}
                weight="light"
                letterSpacing={expand ? 0 : -0.5}
              />
              <SSText color="muted" size={expand ? 'xs' : 'sm'}>
                {t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
          </SSHStack>

          <SSHStack justifyBetween>
            <SSHStack
              gap="xs"
              style={{
                height: expand ? 14 : 22
              }}
            >
              <SSText
                style={{ color: Colors.gray[400] }}
                size={expand ? 'xs' : 'sm'}
              >
                {priceDisplay}
              </SSText>
              <SSText
                style={{
                  color:
                    percentChange[0] === '+' ? Colors.mainGreen : Colors.mainRed
                }}
                size={expand ? 'xs' : 'sm'}
              >
                {percentChange}
              </SSText>
            </SSHStack>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              {walletBalance !== undefined && (
                <SSText color="muted" style={[{ textAlign: 'right' }]}>
                  <SSStyledSatText
                    amount={walletBalance}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    type={transaction.type}
                    textSize={expand ? 'xs' : 'sm'}
                  />
                </SSText>
              )}
              <SSText size="xs" color="muted" style={[{ textAlign: 'right' }]}>
                {t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
          </SSHStack>
        </SSVStack>
        <SSHStack justifyBetween>
          <SSText
            size={expand ? 'xs' : 'md'}
            style={[
              {
                textAlign: 'left',
                flex: 1,
                marginBottom: transaction.label ? 4 : 0
              },
              !transaction.label && { color: Colors.gray[500] }
            ]}
            numberOfLines={1}
          >
            {parseLabel(transaction.label || t('transaction.noLabel')).label}
          </SSText>
          <SSHStack
            gap="xs"
            style={{
              alignSelf: 'flex-end',
              marginBottom: transaction.label ? 8 : 0
            }}
          >
            {transaction.label ? (
              parseLabel(transaction.label).tags.map((tag, index) => (
                <SSText
                  key={index}
                  size={expand ? 'xxs' : 'xs'}
                  style={[
                    { textAlign: 'right' },
                    {
                      backgroundColor: Colors.gray[700],
                      paddingVertical: 2,
                      paddingHorizontal: 6,
                      borderRadius: 4
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
                size={expand ? 'xxs' : 'xs'}
                style={[
                  {
                    textAlign: 'right',
                    color: Colors.gray[500]
                  },
                  {
                    backgroundColor: Colors.gray[950],
                    paddingVertical: expand ? 0 : 2,
                    borderRadius: 4
                  }
                ]}
                uppercase
                numberOfLines={1}
              >
                {t('transaction.noTags')}
              </SSText>
            )}
          </SSHStack>
        </SSHStack>
      </SSVStack>
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

export default SSTransactionCard
