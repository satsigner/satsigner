import { useRouter, type Href } from 'expo-router'
import {
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { useFiatData } from '@/hooks/useFiatData'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout, Sizes } from '@/styles'
import { type Currency } from '@/types/models/Blockchain'
import { type Transaction } from '@/types/models/Transaction'
import {
  formatConfirmationsWithBlock,
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
  link: Href
  expand: boolean
  style?: StyleProp<ViewStyle>
}

const DEFAULT_STYLE: StyleProp<ViewStyle> = {}

function SSTransactionCard({
  transaction,
  blockHeight,
  fiatCurrency,
  btcPrice,
  walletBalance,
  link,
  expand,
  style = DEFAULT_STYLE
}: SSTransactionCardProps) {
  const confirmedAtBlockHeight =
    typeof transaction.blockHeight === 'number' && transaction.blockHeight > 0
      ? transaction.blockHeight
      : null

  const hasConfirmation = confirmedAtBlockHeight !== null

  const confirmations = transaction.blockHeight
    ? blockHeight - transaction.blockHeight + 1
    : 0

  const confirmationColor =
    confirmations < 0
      ? styles.unconfirmed
      : confirmations < 6
        ? styles.confirmedFew
        : styles.confirmedEnough

  const { type, received, sent } = transaction
  const amount = type === 'receive' ? received : sent - received

  const [currencyUnit, useZeroPadding, privacyMode] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.useZeroPadding,
      state.privacyMode
    ])
  )
  const { showCurrentFiat, showHistoricalFiat } = useFiatData()

  const { prices } = transaction
  const oldPrice = showHistoricalFiat && prices ? prices[fiatCurrency] : null
  const historicalPrice = showHistoricalFiat
    ? prices?.[fiatCurrency]
    : undefined
  const currentFiatPrice =
    showCurrentFiat && btcPrice && btcPrice > 0
      ? formatFiatPrice(Math.abs(amount), btcPrice)
      : ''
  const historicalFiatPrice =
    historicalPrice && historicalPrice > 0
      ? formatFiatPrice(Math.abs(amount), historicalPrice)
      : ''
  const hasPriceDisplay = currentFiatPrice !== '' || historicalFiatPrice !== ''

  const percentChange =
    showCurrentFiat &&
    showHistoricalFiat &&
    btcPrice &&
    btcPrice > 0 &&
    oldPrice &&
    oldPrice > 0
      ? formatPercentualChange(btcPrice, oldPrice)
      : ''

  const router = useRouter()

  const smallView = expand || `${amount}`.length > 10

  const parsedLabel = parseLabel(
    transaction.label || t('transaction.noLabel').toUpperCase()
  )

  return (
    <TouchableOpacity onPress={() => router.navigate(link)}>
      <SSVStack
        style={[
          {
            paddingBottom: expand ? 6 : 12,
            paddingHorizontal: 0,
            paddingTop: expand ? 0 : 4
          },
          style
        ]}
        gap="none"
      >
        <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
          {transaction.timestamp ? (
            <SSTimeAgoText
              date={new Date(transaction.timestamp)}
              size="xs"
              live={false}
              suffix={formatTxId(transaction.id, 4)}
              style={{ flex: 1, marginRight: Layout.hStack.gap.sm }}
            />
          ) : (
            <SSText
              color="muted"
              size="xs"
              numberOfLines={1}
              style={{ flex: 1, marginRight: Layout.hStack.gap.sm }}
            >
              {formatTxId(transaction.id, 4)}
            </SSText>
          )}
          <SSHStack gap="none" style={{ flexShrink: 0 }}>
            {hasConfirmation ? (
              <SSText
                size="xs"
                style={
                  confirmations >= 0
                    ? confirmationColor
                    : styles.confirmedEnough
                }
              >
                {confirmations <= 0
                  ? `${t('bitcoin.confirmations.unconfirmed')} • ${confirmedAtBlockHeight.toLocaleString('en-US')}`
                  : formatConfirmationsWithBlock(
                      confirmations,
                      confirmedAtBlockHeight
                    )}
              </SSText>
            ) : (
              <SSText size="xs" style={confirmationColor}>
                {t('bitcoin.confirmations.unconfirmed')}
              </SSText>
            )}
          </SSHStack>
        </SSHStack>
        <SSVStack gap="none" style={{ marginTop: 5 }}>
          <SSHStack
            style={{
              alignItems: 'flex-end',
              justifyContent: 'space-between'
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
                  alignItems: 'baseline'
                }}
              >
                {privacyMode ? (
                  <SSText
                    size={smallView ? 'xl' : '4xl'}
                    weight="light"
                    style={{
                      letterSpacing: smallView ? 0 : -0.5,
                      lineHeight: Sizes.text.fontSize[smallView ? 'xl' : '4xl']
                    }}
                  >
                    ••••
                  </SSText>
                ) : (
                  <SSStyledSatText
                    amount={Math.abs(amount)}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    type={transaction.type}
                    textSize={smallView ? 'xl' : '4xl'}
                    noColor={false}
                    showSign={false}
                    weight="light"
                    letterSpacing={smallView ? 0 : -0.5}
                  />
                )}
                <SSText color="muted" size={smallView ? 'xs' : 'sm'}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
            </SSHStack>
            {walletBalance !== undefined && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                {privacyMode ? (
                  <SSText
                    size={smallView ? 'xs' : 'sm'}
                    color="muted"
                    style={{
                      lineHeight: Sizes.text.fontSize[smallView ? 'xs' : 'sm']
                    }}
                  >
                    ••••
                  </SSText>
                ) : (
                  <SSStyledSatText
                    amount={walletBalance}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    type={transaction.type}
                    textSize={smallView ? 'xs' : 'sm'}
                  />
                )}
                <SSText color="muted" size={smallView ? 'xs' : 'sm'}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
            )}
          </SSHStack>
          {hasPriceDisplay && (
            <SSHStack justifyBetween>
              <SSHStack
                gap="xs"
                style={{
                  height: smallView ? 14 : 22
                }}
              >
                {privacyMode ? (
                  <SSText
                    style={{ color: Colors.gray[400] }}
                    size={smallView ? 'xs' : 'sm'}
                  >
                    ••••
                  </SSText>
                ) : (
                  <>
                    {currentFiatPrice !== '' ? (
                      <SSText
                        style={{ color: Colors.gray[400] }}
                        size={smallView ? 'xs' : 'sm'}
                      >
                        {currentFiatPrice}
                      </SSText>
                    ) : null}
                    <SSText
                      style={{ color: Colors.gray[500] }}
                      size={smallView ? 'xs' : 'sm'}
                    >
                      {fiatCurrency}
                    </SSText>
                    {historicalFiatPrice !== '' ? (
                      <SSText
                        style={{ color: Colors.gray[400] }}
                        size={smallView ? 'xs' : 'sm'}
                      >
                        ({historicalFiatPrice})
                      </SSText>
                    ) : null}
                  </>
                )}
                {!privacyMode && percentChange !== '' && (
                  <SSText
                    style={{
                      color:
                        percentChange[0] === '+'
                          ? Colors.softBarGreen
                          : Colors.softBarRed
                    }}
                    size={smallView ? 'xs' : 'sm'}
                  >
                    {percentChange}
                  </SSText>
                )}
              </SSHStack>
            </SSHStack>
          )}
        </SSVStack>
        <SSHStack
          justifyBetween
          style={{
            alignItems: 'center'
          }}
        >
          <SSText
            size={smallView ? 'xxs' : 'xs'}
            style={[
              {
                flex: 1,
                marginRight: Layout.hStack.gap.sm,
                textAlign: 'left'
              },
              !transaction.label && { color: Colors.gray[500] }
            ]}
            numberOfLines={1}
          >
            {parsedLabel.label}
          </SSText>
          <SSHStack gap="xs" style={{ flexShrink: 0 }}>
            {transaction.label ? (
              parsedLabel.tags.map((tag, index) => (
                <SSText
                  key={index}
                  size={smallView ? 'xxs' : 'xs'}
                  style={[
                    { alignSelf: 'flex-start', textAlign: 'right' },
                    {
                      backgroundColor: Colors.gray[700],
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2
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
                    color: Colors.gray[500],
                    textAlign: 'right'
                  },
                  {
                    backgroundColor: Colors.gray[950],
                    borderRadius: 4,
                    paddingVertical: smallView ? 0 : 2
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
  confirmedEnough: {
    color: Colors.gray[400]
  },
  confirmedFew: {
    color: Colors.warning
  },
  unconfirmed: {
    color: Colors.error
  }
})

export default SSTransactionCard
