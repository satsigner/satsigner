import { useEffect, useState } from 'react'
import { Platform, TouchableOpacity } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated'
import { useShallow } from 'zustand/react/shallow'

import { useFiatData } from '@/hooks/useFiatData'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Layout, Sizes } from '@/styles'
import { type Account } from '@/types/models/Account'
import { formatNumber } from '@/utils/format'

import { SSIconChevronRight, SSIconEyeOn } from './icons'
import SSIconSync from './icons/SSIconSync'
import SSFingerprint from './SSFingerprint'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'

export type SSAccountCardStat = {
  label: string
  value: number
}

type SSAccountCardProps = {
  name: string
  balance: number
  onPress(): void
  fingerprint?: string
  watchOnly?: boolean
  syncStatus?: Account['syncStatus']
  lastSyncedAt?: Account['lastSyncedAt']
  stats?: SSAccountCardStat[]
}

function SSAccountCard({
  name,
  balance,
  onPress,
  fingerprint,
  watchOnly = false,
  syncStatus,
  lastSyncedAt,
  stats
}: SSAccountCardProps) {
  const platform = Platform.OS
  const { showCurrentFiat } = useFiatData()
  const [fiatCurrency, satsToFiat, btcPrice] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.satsToFiat,
      state.btcPrice
    ])
  )
  const [currencyUnit, useZeroPadding, privacyMode] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.useZeroPadding,
      state.privacyMode
    ])
  )

  const rotation = useSharedValue(0)

  useEffect(() => {
    if (syncStatus === 'syncing') {
      rotation.set(
        withRepeat(
          withTiming(360, { duration: 1500, easing: Easing.linear }),
          -1,
          false
        )
      )
    } else {
      cancelAnimation(rotation)
      rotation.set(0)
    }

    return () => {
      cancelAnimation(rotation)
      rotation.set(0)
    }
  }, [syncStatus, rotation])

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }]
  }))

  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000))

  function renderSyncStatus(
    status: Account['syncStatus'],
    date: Account['lastSyncedAt']
  ) {
    let color = Colors.white
    let text = ''
    let icon: React.ReactNode = null

    switch (status) {
      case 'unsynced':
        color = Colors.gray[200] // eslint-disable-line prefer-destructuring
        text = t('account.sync.status.unsynced')
        break
      case 'synced': {
        color = Colors.mainGreen
        text = t('account.sync.status.synced')

        if (date !== undefined) {
          const diff = nowSeconds - date.getTime() / 1000

          const hours = Math.floor(diff / 3600)
          const days = Math.floor(hours / 24)
          const months = Math.floor(days / 30)
          const years = Math.floor(days / 365)

          if (hours >= 1) {
            color = Colors.gray[75] // eslint-disable-line prefer-destructuring
            text = `${t('account.sync.status.synced')} ${t(
              'account.sync.status.old.hour',
              { value: hours }
            )}`
            if (days >= 1) {
              text = `${t('account.sync.status.synced')} ${t(
                'account.sync.status.old.day',
                { value: days }
              )}`
            }
            if (months >= 1) {
              text = `${t('account.sync.status.synced')} ${t(
                'account.sync.status.old.month',
                { value: months }
              )}`
            }
            if (years >= 1) {
              text = `${t('account.sync.status.synced')} ${t(
                'account.sync.status.old.year',
                { value: years }
              )}`
            }
          }
        }
        break
      }
      case 'syncing': {
        color = Colors.white
        text = t('account.sync.status.syncing')
        icon = (
          <Animated.View style={rotateStyle}>
            <SSIconSync width={10} height={9} />
          </Animated.View>
        )
        break
      }
      case 'error':
        color = Colors.mainRed
        text = t('account.sync.status.error')
        break
      case 'timeout':
        color = Colors.mainRed
        text = t('account.sync.status.timeout')
        break
      default:
        break
    }

    return (
      <SSHStack
        gap="xs"
        style={{
          opacity: 0.6,
          position: 'absolute',
          right: 6,
          top: 0
        }}
      >
        <SSText size="xs" uppercase style={{ color }}>
          {text}
        </SSText>
        {icon}
      </SSHStack>
    )
  }

  return (
    <TouchableOpacity activeOpacity={0.5} onPress={() => onPress()}>
      <SSHStack justifyBetween style={{ position: 'relative' }}>
        <SSVStack gap={platform === 'android' ? 'none' : 'xxs'}>
          {fingerprint ? <SSFingerprint fingerprint={fingerprint} /> : null}
          <SSHStack gap="sm" style={{ alignItems: 'center' }}>
            <SSText size="lg" color="muted">
              {name}
            </SSText>
            {watchOnly && <SSIconEyeOn height={16} width={16} />}
          </SSHStack>
          <SSVStack gap="none">
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSText
                size="3xl"
                color="white"
                style={{ lineHeight: Sizes.text.fontSize['3xl'] }}
              >
                {privacyMode ? (
                  '••••'
                ) : (
                  <SSStyledSatText
                    amount={balance}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    textSize="3xl"
                    weight="light"
                    letterSpacing={-1}
                  />
                )}
              </SSText>
              <SSText size="xl" color="muted">
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
            </SSHStack>
            {showCurrentFiat ? (
              <SSHStack
                gap="xs"
                style={{
                  alignItems: 'baseline',
                  marginTop: -Layout.vStack.gap.xs
                }}
              >
                <SSText color="muted">
                  {!btcPrice || btcPrice <= 0
                    ? '--'
                    : privacyMode
                      ? '••••'
                      : formatNumber(satsToFiat(balance), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            ) : null}
          </SSVStack>
          {stats && stats.length > 0 ? (
            <SSHStack>
              {stats.map((stat) => (
                <SSVStack gap="none" key={stat.label}>
                  <SSText color="white" size="md">
                    {formatNumber(stat.value)}
                  </SSText>
                  <SSText size="xs" color="muted">
                    {stat.label}
                  </SSText>
                </SSVStack>
              ))}
            </SSHStack>
          ) : null}
        </SSVStack>
        <SSIconChevronRight height={11.6} width={6} />
        {syncStatus ? renderSyncStatus(syncStatus, lastSyncedAt) : null}
      </SSHStack>
    </TouchableOpacity>
  )
}

export default SSAccountCard
