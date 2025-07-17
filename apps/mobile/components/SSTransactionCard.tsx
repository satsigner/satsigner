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
  formatPercentualChange,
  formatTxId
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
  const hasConfirmation = transaction.blockHeight && transaction.blockHeight > 0

  const confirmations = transaction.blockHeight
    ? blockHeight - transaction.blockHeight + 1
    : 0

  const confirmationColor =
    confirmations < 0
      ? styles.unconfirmed
      : confirmations < 6
        ? styles.confirmedFew
        : styles.confirmedEnough

  const [priceDisplay, setPriceDisplay] = useState('')
  const [percentChange, setPercentChange] = useState('')

  const { type, received, sent } = transaction
  const amount = type === 'receive' ? received : sent - received

  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  useEffect(() => {
    const { prices } = transaction
    const itemsToDisplay: string[] = []

    const oldPrice = prices ? prices[fiatCurrency] : null

    if (btcPrice) {
      itemsToDisplay.push(formatFiatPrice(amount, btcPrice))
    }

    if (prices && prices[fiatCurrency]) {
      itemsToDisplay.push(
        '(' + formatFiatPrice(amount, prices[fiatCurrency] || 0) + ')'
      )
    }

    if (btcPrice || oldPrice) {
      itemsToDisplay.push(fiatCurrency)
    }

    if (btcPrice && oldPrice) {
      setPercentChange(formatPercentualChange(btcPrice, oldPrice))
    }

    setPriceDisplay(itemsToDisplay.join(' '))
  }, [btcPrice, fiatCurrency, amount, transaction])

  const router = useRouter()

  const smallView = expand || `${amount}`.length > 10

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
        <SSHStack justifyBetween>
          <SSText color="muted" size="xs">
            {formatTxId(transaction.id)}
          </SSText>
          <SSHStack gap="none">
            {(confirmations >= 0 || !hasConfirmation) && (
              <SSText size="xs" style={confirmationColor}>
                {formatConfirmations(confirmations) + ' - '}
              </SSText>
            )}
            <SSText
              size="xs"
              style={
                confirmations >= 0 ? confirmationColor : styles.confirmedEnough
              }
            >
              {`${t('bitcoin.block')} ${transaction.blockHeight}`}
            </SSText>
          </SSHStack>
        </SSHStack>

        {transaction.timestamp && (
          <SSTimeAgoText
            date={new Date(transaction.timestamp)}
            size="xs"
            style={{ marginTop: -5 }}
          />
        )}

        <SSVStack gap="none" style={{ marginTop: 5 }}>
          <SSHStack
            style={{
              justifyContent: 'space-between',
              alignItems: 'flex-end'
            }}
          >
            <SSHStack
              gap={smallView ? 'xs' : 'sm'}
              style={{
                alignItems: 'center'
              }}
            >
              {transaction.type === 'receive' && (
                <SSIconIncoming
                  height={smallView ? 12 : 21}
                  width={smallView ? 12 : 21}
                />
              )}
              {transaction.type === 'send' && (
                <SSIconOutgoing
                  height={smallView ? 12 : 21}
                  width={smallView ? 12 : 21}
                />
              )}
              <SSHStack
                gap="xxs"
                style={{
                  alignItems: 'flex-end'
                }}
              >
                <SSStyledSatText
                  amount={amount}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  type={transaction.type}
                  textSize={smallView ? 'xl' : '4xl'}
                  noColor={false}
                  weight="light"
                  letterSpacing={smallView ? 0 : -0.5}
                />
                <SSText color="muted" size={smallView ? 'xs' : 'sm'}>
                  {t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
            </SSHStack>
            {walletBalance !== undefined && (
              <SSHStack gap="xs">
                <SSText color="muted">
                  <SSStyledSatText
                    amount={walletBalance}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    type={transaction.type}
                    textSize={smallView ? 'xs' : 'sm'}
                  />
                </SSText>
                <SSText size="xs" color="muted">
                  {t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
            )}
          </SSHStack>

          {priceDisplay !== '' && percentChange !== '' && (
            <SSHStack justifyBetween>
              <SSHStack
                gap="xs"
                style={{
                  height: smallView ? 14 : 22
                }}
              >
                <SSText
                  style={{ color: Colors.gray[400] }}
                  size={smallView ? 'xs' : 'sm'}
                >
                  {priceDisplay}
                </SSText>
                <SSText
                  style={{
                    color:
                      percentChange[0] === '+'
                        ? Colors.mainGreen
                        : Colors.mainRed
                  }}
                  size={smallView ? 'xs' : 'sm'}
                >
                  {percentChange}
                </SSText>
              </SSHStack>
            </SSHStack>
          )}
        </SSVStack>
        <SSHStack justifyBetween>
          <SSText
            size={smallView ? 'xxs' : 'xs'}
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
            {
              parseLabel(
                transaction.label || t('transaction.noLabel').toUpperCase()
              ).label
            }
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
                  size={smallView ? 'xxs' : 'xs'}
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
                size={smallView ? 'xxs' : 'xs'}
                style={[
                  {
                    textAlign: 'right',
                    color: Colors.gray[500]
                  },
                  {
                    backgroundColor: Colors.gray[950],
                    paddingVertical: smallView ? 0 : 2,
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
