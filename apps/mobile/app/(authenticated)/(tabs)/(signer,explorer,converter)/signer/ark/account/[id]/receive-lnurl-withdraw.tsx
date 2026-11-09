import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import { fetchArkLightningReceive } from '@/api/ark'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  useArkLnurlWithdraw,
  useArkLnurlWithdrawDetails
} from '@/hooks/useArkLnurlWithdraw'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getArkAccountOrThrow } from '@/store/ark'
import { Colors } from '@/styles'
import { hasArkLightningReceiveArrived } from '@/utils/arkLightningReceive'
import { millisatsToSats } from '@/utils/bitcoinUnits'
import { resolveLnurlUrl } from '@/utils/lnurl'

const AWAIT_TIMEOUT_MS = 120_000
const AWAIT_POLL_INTERVAL_MS = 3000

// Arrival is read from this invoice's own receive state: the balance also
// moves for unrelated funds and is not known before the first load.
type WithdrawPhase =
  | { status: 'ready' }
  | { status: 'awaiting'; deadline: number; paymentHash: string }
  | { status: 'success' }
  | { status: 'timeout' }

function safeServiceHost(lnurl: string): string | null {
  try {
    return new URL(resolveLnurlUrl(lnurl)).host
  } catch {
    return null
  }
}

export default function ArkReceiveLnurlWithdrawPage() {
  const router = useRouter()
  const { id, lnurl } = useLocalSearchParams<{ id: string; lnurl: string }>()

  const detailsQuery = useArkLnurlWithdrawDetails(id, lnurl)
  const withdrawMutation = useArkLnurlWithdraw(id)

  const [userAmount, setUserAmount] = useState<string | null>(null)
  const [withdraw, setWithdraw] = useState<WithdrawPhase>({
    status: 'ready'
  })
  const phase = withdraw.status

  // A failed check still counts toward the deadline, so a server that stops
  // answering ends in the timeout state instead of waiting forever.
  async function fetchWithdrawReceive(paymentHash: string) {
    try {
      return await fetchArkLightningReceive(
        getArkAccountOrThrow(id).serverId,
        id,
        paymentHash
      )
    } catch {
      return null
    }
  }

  async function checkWithdrawArrival(paymentHash: string, deadline: number) {
    const receive = await fetchWithdrawReceive(paymentHash)
    if (receive && hasArkLightningReceiveArrived(receive)) {
      setWithdraw({ status: 'success' })
      toast.success(t('ark.receive.lnurlWithdraw.success'))
      return receive.state
    }
    if (Date.now() >= deadline) {
      setWithdraw({ status: 'timeout' })
    }
    return receive?.state ?? null
  }

  const awaiting = withdraw.status === 'awaiting' ? withdraw : null
  useQuery({
    enabled: awaiting !== null,
    queryFn: () =>
      awaiting
        ? checkWithdrawArrival(awaiting.paymentHash, awaiting.deadline)
        : null,
    queryKey: ['ark', 'lnurl-withdraw-receive', id, awaiting?.paymentHash],
    refetchInterval: AWAIT_POLL_INTERVAL_MS
  })

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
    withdrawMutation.mutate(
      { amountSats, details },
      {
        onError: (error) => {
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(
            `${t('ark.receive.lnurlWithdraw.error.request')}: ${reason}`
          )
        },
        onSuccess: (result) => {
          setWithdraw({
            deadline: Date.now() + AWAIT_TIMEOUT_MS,
            paymentHash: result.paymentHash,
            status: 'awaiting'
          })
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
      <SSScrollView>
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
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  }
})
