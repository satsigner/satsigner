import { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Account } from '@/types/models/Account'
import { formatNumber } from '@/utils/format'

import { SSIconChevronRight, SSIconEyeOn } from './icons'
import SSIconSync from './icons/SSIconSync'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'

type SSAccountCardProps = {
  account: Account
  onPress(): void
}

function SSAccountCard({ account, onPress }: SSAccountCardProps) {
  const platform = Platform.OS
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)

  const rotateAnim = useRef(new Animated.Value(0)).current
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (account.syncStatus === 'syncing') {
      animationRef.current = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true
        })
      )
      animationRef.current.start()
    } else {
      animationRef.current?.stop()
      rotateAnim.setValue(0)
    }

    return () => {
      animationRef.current?.stop()
      rotateAnim.setValue(0)
    }
  }, [account.syncStatus, rotateAnim])

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  })

  function renderSyncStatus(
    status: Account['syncStatus'],
    date: Account['lastSyncedAt']
  ) {
    let color = Colors.white
    let text = ''
    let icon: React.ReactNode = null

    switch (status) {
      case 'unsynced':
        color = Colors.gray[200]
        text = t('account.sync.status.unsynced')
        break
      case 'synced': {
        color = Colors.mainGreen
        text = t('account.sync.status.synced')

        if (date !== undefined) {
          const now = Math.floor(Date.now() / 1000)
          const diff = now - new Date(date).getTime() / 1000

          const hours = Math.floor(diff / 3600)
          const days = Math.floor(hours / 24)
          const months = Math.floor(days / 30)
          const years = Math.floor(days / 365)

          if (hours >= 1) {
            color = Colors.gray[75]
            text = `${t('account.sync.status.synced')} ${t('account.sync.status.old.hour', { value: hours })}`
            if (days >= 1)
              text = `${t('account.sync.status.synced')} ${t('account.sync.status.old.day', { value: days })}`
            if (months >= 1)
              text = `${t('account.sync.status.synced')} ${t('account.sync.status.old.month', { value: months })}`
            if (years >= 1)
              text = `${t('account.sync.status.synced')} ${t('account.sync.status.old.year', { value: years })}`
          }
        }
        break
      }
      case 'syncing': {
        color = Colors.white
        text = t('account.sync.status.syncing')
        icon = (
          <Animated.View style={{ transform: [{ rotate }] }}>
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
    }

    return (
      <SSHStack
        gap="xs"
        style={{
          position: 'absolute',
          top: 0,
          right: 6,
          opacity: 0.6
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
          {account.policyType === 'watchonly' ? null : (
            <SSText
              size="xs"
              style={{ color: Colors.gray[500], lineHeight: 10 }}
            >
              {account.keys[0].fingerprint}
            </SSText>
          )}
          <SSHStack gap="sm">
            <SSText size="lg" color="muted">
              {account.name}
            </SSText>
            {account.policyType === 'watchonly' && (
              <SSIconEyeOn height={16} width={16} />
            )}
          </SSHStack>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSText
              size="3xl"
              color="white"
              style={{ lineHeight: platform === 'android' ? 24 : undefined }}
            >
              <SSStyledSatText
                amount={account?.summary.balance || 0}
                decimals={0}
                useZeroPadding={useZeroPadding}
                textSize="3xl"
                weight="light"
                letterSpacing={-1}
              />
            </SSText>
            <SSText size="xl" color="muted">
              {t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack
            gap="xs"
            style={{
              alignItems: 'baseline',
              paddingVertical: platform === 'android' ? 0 : 1
            }}
          >
            <SSText color="muted">
              {formatNumber(satsToFiat(account.summary.balance), 2)}
            </SSText>
            <SSText size="xs" style={{ color: Colors.gray[500] }}>
              {fiatCurrency}
            </SSText>
          </SSHStack>
          <SSHStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfTransactions)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.totalTransactions')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfAddresses)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.derivedAddresses')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.numberOfUtxos)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.spendableOutputs')}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText color="white" size="md">
                {formatNumber(account.summary.satsInMempool)}
              </SSText>
              <SSText size="xs" color="muted">
                {t('accounts.satsInMempool')}
              </SSText>
            </SSVStack>
          </SSHStack>
        </SSVStack>
        <SSIconChevronRight height={11.6} width={6} />
        {renderSyncStatus(account.syncStatus, account.lastSyncedAt)}
      </SSHStack>
    </TouchableOpacity>
  )
}

export default SSAccountCard
