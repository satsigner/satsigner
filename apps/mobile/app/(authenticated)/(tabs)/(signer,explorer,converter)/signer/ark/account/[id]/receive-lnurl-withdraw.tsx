import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useArkBalance } from '@/hooks/useArkBalance'
import {
  useArkLnurlWithdraw,
  useArkLnurlWithdrawDetails
} from '@/hooks/useArkLnurlWithdraw'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { millisatsToSats } from '@/utils/bitcoinUnits'
import { decodeLNURL, isLNURL } from '@/utils/lnurl'

const AWAIT_TIMEOUT_MS = 120_000

type Phase = 'ready' | 'awaiting' | 'success' | 'timeout'

function safeServiceHost(lnurl: string): string | null {
  try {
    const cleaned = lnurl.trim().replace(/^lightning:/i, '')
    const url = isLNURL(cleaned) ? decodeLNURL(cleaned) : cleaned
    return new URL(url).host
  } catch {
    return null
  }
}

export default function ArkReceiveLnurlWithdrawPage() {
  const router = useRouter()
  const { id, lnurl } = useLocalSearchParams<{ id: string; lnurl: string }>()

  const detailsQuery = useArkLnurlWithdrawDetails(id, lnurl)
  const withdrawMutation = useArkLnurlWithdraw(id)
  const balanceQuery = useArkBalance(id)

  const [userAmount, setUserAmount] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const baselineRef = useRef<number | null>(null)
  const expectedDeltaRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const details = detailsQuery.data
  const minSats = details ? millisatsToSats(details.minWithdrawable, 'ceil') : 0
  const maxSats = details
    ? millisatsToSats(details.maxWithdrawable, 'floor')
    : 0
  const serviceHost = safeServiceHost(lnurl ?? '')
  const isFixedAmount = minSats > 0 && minSats === maxSats
  const amount = isFixedAmount ? String(minSats) : (userAmount ?? '')
  const amountSats = Number(amount || 0)
  const amountInRange =
    Number.isFinite(amountSats) &&
    amountSats >= minSats &&
    amountSats <= maxSats &&
    amountSats > 0

  useEffect(() => {
    if (phase !== 'awaiting') {
      return
    }
    if (baselineRef.current === null) {
      return
    }
    const balance = balanceQuery.data
    if (!balance) {
      return
    }
    const total = balance.spendableSats + balance.claimableLightningReceiveSats
    const delta = total - baselineRef.current
    if (delta >= expectedDeltaRef.current) {
      setPhase('success')
      toast.success(t('ark.receive.lnurlWithdraw.success'))
    }
  }, [phase, balanceQuery.data])

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    []
  )

  function handleConfirm() {
    if (!details) {
      return
    }
    if (!amountInRange) {
      toast.error(
        t('ark.receive.lnurlWithdraw.amountOutOfRange', {
          max: maxSats,
          min: minSats
        })
      )
      return
    }
    const balance = balanceQuery.data
    baselineRef.current = balance
      ? balance.spendableSats + balance.claimableLightningReceiveSats
      : 0
    expectedDeltaRef.current = amountSats
    withdrawMutation.mutate(
      { amountSats, details },
      {
        onError: (error) => {
          baselineRef.current = null
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(
            `${t('ark.receive.lnurlWithdraw.error.request')}: ${reason}`
          )
        },
        onSuccess: () => {
          setPhase('awaiting')
          timeoutRef.current = setTimeout(() => {
            setPhase((prev) => (prev === 'awaiting' ? 'timeout' : prev))
          }, AWAIT_TIMEOUT_MS)
        }
      }
    )
  }

  function handleClose() {
    router.back()
  }

  if (detailsQuery.isLoading) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('ark.receive.lnurlWithdraw.title')}</SSText>
            )
          }}
        />
        <SSVStack style={styles.container}>
          <SSText center color="muted">
            {t('common.loading')}
          </SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  if (detailsQuery.error || !details) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('ark.receive.lnurlWithdraw.title')}</SSText>
            )
          }}
        />
        <SSVStack gap="lg" style={styles.container}>
          <SSText center style={{ color: Colors.warning }}>
            {t('ark.receive.lnurlWithdraw.error.fetch')}
          </SSText>
          <SSButton
            label={t('ark.receive.lnurlWithdraw.cancel')}
            onPress={handleClose}
            variant="ghost"
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.receive.lnurlWithdraw.title')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          {serviceHost && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.receive.lnurlWithdraw.service')}
              </SSText>
              <SSText>{serviceHost}</SSText>
            </SSVStack>
          )}

          {details.defaultDescription && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.receive.lnurlWithdraw.description')}
              </SSText>
              <SSText>{details.defaultDescription}</SSText>
            </SSVStack>
          )}

          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.receive.lnurlWithdraw.amount')}
            </SSText>
            <SSText color="muted" size="xs">
              {t('ark.receive.lnurlWithdraw.range', {
                max: maxSats,
                min: minSats
              })}
            </SSText>
            <SSTextInput
              align="left"
              value={amount}
              onChangeText={setUserAmount}
              placeholder={t('ark.receive.lnurlWithdraw.amountPlaceholder')}
              keyboardType="numeric"
              editable={phase === 'ready' && !isFixedAmount}
            />
          </SSVStack>

          {phase === 'ready' && (
            <SSVStack gap="sm">
              <SSButton
                label={t('ark.receive.lnurlWithdraw.confirm')}
                onPress={handleConfirm}
                variant="secondary"
                disabled={!amountInRange || withdrawMutation.isPending}
                loading={withdrawMutation.isPending}
              />
              <SSButton
                label={t('ark.receive.lnurlWithdraw.cancel')}
                onPress={handleClose}
                variant="ghost"
              />
            </SSVStack>
          )}

          {phase === 'awaiting' && (
            <SSVStack gap="sm">
              <SSText center>{t('ark.receive.lnurlWithdraw.awaiting')}</SSText>
              <SSButton
                label={t('ark.receive.lnurlWithdraw.cancel')}
                onPress={handleClose}
                variant="ghost"
              />
            </SSVStack>
          )}

          {phase === 'success' && (
            <SSVStack gap="sm">
              <SSText center>{t('ark.receive.lnurlWithdraw.success')}</SSText>
              <SSButton
                label={t('common.close')}
                onPress={handleClose}
                variant="secondary"
              />
            </SSVStack>
          )}

          {phase === 'timeout' && (
            <SSVStack gap="sm">
              <SSText center color="muted">
                {t('ark.receive.lnurlWithdraw.timeout')}
              </SSText>
              <SSButton
                label={t('common.close')}
                onPress={handleClose}
                variant="ghost"
              />
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  }
})
