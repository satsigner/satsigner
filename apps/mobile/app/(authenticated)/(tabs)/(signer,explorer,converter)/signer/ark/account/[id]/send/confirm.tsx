import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkSend } from '@/hooks/useArkSend'
import {
  type ArkSendFeeKind,
  useArkSendFeeEstimate
} from '@/hooks/useArkSendFeeEstimate'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import type {
  ArkSendInput,
  ArkSendKind,
  ArkSendOutcome
} from '@/types/models/Ark'
import {
  type ArkDestinationDraft,
  parseArkDestination
} from '@/utils/arkDestination'
import { truncateArkCounterparty } from '@/utils/arkMovement'
import { formatFiatPrice, formatNumber } from '@/utils/format'

const KIND_LABEL_KEYS: Record<ArkSendKind, string> = {
  arkoor: 'ark.send.kind.arkoor',
  bolt11: 'ark.send.kind.bolt11',
  lnaddress: 'ark.send.kind.lnaddress',
  lnurl: 'ark.send.kind.lnurl'
}

const CONFIRM_COUNTERPARTY_TRUNCATE_CHARS = 14

function destinationDisplay(draft: ArkDestinationDraft): string {
  if (draft.kind === 'arkoor') {
    return truncateArkCounterparty(
      draft.address,
      CONFIRM_COUNTERPARTY_TRUNCATE_CHARS
    )
  }
  if (draft.kind === 'bolt11') {
    return truncateArkCounterparty(
      draft.invoice,
      CONFIRM_COUNTERPARTY_TRUNCATE_CHARS
    )
  }
  if (draft.kind === 'lnaddress') {
    return draft.address
  }
  return truncateArkCounterparty(
    draft.lnurl,
    CONFIRM_COUNTERPARTY_TRUNCATE_CHARS
  )
}

function buildSendInput(
  draft: ArkDestinationDraft,
  amountSats: number,
  comment: string
): ArkSendInput {
  const trimmedComment = comment.trim()
  if (draft.kind === 'arkoor') {
    return { address: draft.address, amountSats, kind: 'arkoor' }
  }
  if (draft.kind === 'bolt11') {
    return {
      amountSats: draft.amountSatsFromInvoice ? undefined : amountSats,
      invoice: draft.invoice,
      kind: 'bolt11'
    }
  }
  if (draft.kind === 'lnaddress') {
    return {
      address: draft.address,
      amountSats,
      comment: trimmedComment || undefined,
      kind: 'lnaddress'
    }
  }
  return {
    amountSats,
    comment: trimmedComment || undefined,
    kind: 'lnurl',
    lnurl: draft.lnurl
  }
}

function successToastKey(outcome: ArkSendOutcome): string {
  if (outcome.kind === 'arkoor') {
    return 'ark.send.success.arkoor'
  }
  if (outcome.preimage) {
    return 'ark.send.success.lightning'
  }
  return 'ark.send.success.lightningPending'
}

export default function ArkSendConfirmPage() {
  const router = useRouter()
  const { id, destination } = useLocalSearchParams<{
    id: string
    destination: string
  }>()

  const parsedQuery = useQuery<ArkDestinationDraft>({
    enabled: Boolean(destination),
    queryFn: async () => {
      const parsed = await parseArkDestination(destination ?? '')
      if (!parsed.ok) {
        throw new Error(t('ark.send.error.invalidDestination'))
      }
      return parsed.draft
    },
    queryKey: ['ark', 'send', 'parse', destination],
    staleTime: Infinity
  })

  const [amountInput, setAmountInput] = useState('')
  const [comment, setComment] = useState('')
  const sendMutation = useArkSend(id)
  const balanceQuery = useArkBalance(id)

  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const draft = parsedQuery.data
  const spendableSats = balanceQuery.data?.spendableSats ?? 0
  const amountFromInvoice =
    draft?.kind === 'bolt11' ? draft.amountSatsFromInvoice : undefined
  const amountSats =
    amountFromInvoice ?? (Number.parseInt(amountInput, 10) || 0)
  const amountIsEditable = amountFromInvoice === undefined
  const showCommentField =
    draft?.kind === 'lnaddress' || draft?.kind === 'lnurl'

  const feeKind: ArkSendFeeKind | null = draft
    ? draft.kind === 'arkoor'
      ? 'arkoor'
      : 'lightning'
    : null
  // Fire fee estimation on the debounced amount so the estimator doesn't
  // run per-keystroke. Fixed-amount invoices don't animate, so the debounce
  // is effectively a no-op for them.
  const debouncedAmountSats = useDebouncedValue(amountSats)
  const feeEstimateQuery = useArkSendFeeEstimate({
    accountId: id,
    amountSats: debouncedAmountSats,
    kind: feeKind
  })
  const feeSats = feeEstimateQuery.data
    ? feeEstimateQuery.data.feeSats
    : undefined
  const totalSats = feeSats !== undefined ? amountSats + feeSats : undefined

  const exceedsBalance =
    totalSats !== undefined
      ? totalSats > spendableSats
      : amountSats > spendableSats
  const canConfirm =
    !!draft && amountSats > 0 && !exceedsBalance && !sendMutation.isPending

  function handleAmountChange(text: string) {
    setAmountInput(text.replace(/[^0-9]/g, ''))
  }

  function handleConfirm() {
    if (!draft) {
      return
    }
    if (amountSats <= 0) {
      toast.error(t('ark.error.invalidAmount'))
      return
    }
    const input = buildSendInput(draft, amountSats, comment)
    sendMutation.mutate(input, {
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : t('ark.send.error.generic')
        toast.error(message)
      },
      onSuccess: (outcome) => {
        toast.success(t(successToastKey(outcome)))
        router.replace({
          params: { id },
          pathname: '/signer/ark/account/[id]'
        })
      }
    })
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ark.send.confirmTitle')}</SSText>
          )
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          {parsedQuery.isLoading && (
            <SSText color="muted" center>
              {t('common.loading')}
            </SSText>
          )}
          {parsedQuery.error && (
            <SSText style={{ color: Colors.warning }} center>
              {t('ark.send.error.invalidDestination')}
            </SSText>
          )}
          {draft && (
            <>
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t(KIND_LABEL_KEYS[draft.kind])}
                </SSText>
                <View style={styles.destinationBox}>
                  <SSClipboardCopy text={destinationSource(draft)}>
                    <SSText size="sm" style={styles.monospace}>
                      {destinationDisplay(draft)}
                    </SSText>
                  </SSClipboardCopy>
                </View>
              </SSVStack>
              {draft.kind === 'bolt11' && draft.description && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    {t('common.description')}
                  </SSText>
                  <SSText>{draft.description}</SSText>
                </SSVStack>
              )}
              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.send.amount')} ({t('bitcoin.sats')})
                </SSText>
                {amountIsEditable ? (
                  <SSTextInput
                    align="left"
                    value={
                      amountInput
                        ? formatNumber(Number.parseInt(amountInput, 10))
                        : ''
                    }
                    onChangeText={handleAmountChange}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                ) : (
                  <SSText size="lg">{formatNumber(amountSats)}</SSText>
                )}
                {btcPrice > 0 && amountSats > 0 && (
                  <SSText color="muted" size="xs">
                    {formatFiatPrice(amountSats, btcPrice)} {fiatCurrency}
                  </SSText>
                )}
                <SSText color="muted" size="xs">
                  {t('ark.send.spendable', {
                    amount: formatNumber(spendableSats)
                  })}
                </SSText>
                {exceedsBalance && (
                  <SSText size="xs" style={{ color: Colors.warning }}>
                    {t(
                      feeSats === undefined
                        ? 'ark.send.error.insufficientBalance'
                        : 'ark.send.error.insufficientBalanceWithFee'
                    )}
                  </SSText>
                )}
              </SSVStack>
              {amountSats > 0 && (
                <SSVStack gap="xs">
                  <SSHStack justifyBetween>
                    <SSText color="muted" size="xs" uppercase>
                      {t('ark.send.fee')}
                    </SSText>
                    {feeSats !== undefined ? (
                      <SSText size="xs">
                        {formatNumber(feeSats)} {t('bitcoin.sats')}
                      </SSText>
                    ) : feeEstimateQuery.isPending ? (
                      <SSText color="muted" size="xs">
                        {t('ark.send.feeEstimating')}
                      </SSText>
                    ) : feeEstimateQuery.error ? (
                      <SSText size="xs" style={{ color: Colors.warning }}>
                        {t('ark.send.feeUnavailable')}
                      </SSText>
                    ) : null}
                  </SSHStack>
                  {totalSats !== undefined && (
                    <SSHStack justifyBetween>
                      <SSText color="muted" size="xs" uppercase>
                        {t('ark.send.total')}
                      </SSText>
                      <SSVStack gap="none" style={styles.totalRightColumn}>
                        <SSText size="xs">
                          {formatNumber(totalSats)} {t('bitcoin.sats')}
                        </SSText>
                        {btcPrice > 0 && (
                          <SSText color="muted" size="xs">
                            {formatFiatPrice(totalSats, btcPrice)}{' '}
                            {fiatCurrency}
                          </SSText>
                        )}
                      </SSVStack>
                    </SSHStack>
                  )}
                </SSVStack>
              )}
              {showCommentField && (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.send.comment')}
                  </SSText>
                  <SSTextInput
                    align="left"
                    value={comment}
                    onChangeText={setComment}
                    placeholder={t('ark.send.commentPlaceholder')}
                  />
                </SSVStack>
              )}
              <SSHStack gap="sm" style={styles.actions}>
                <SSButton
                  label={t('common.cancel')}
                  onPress={() => router.back()}
                  variant="ghost"
                  style={styles.actionButton}
                  disabled={sendMutation.isPending}
                />
                <SSButton
                  label={t('ark.send.confirm')}
                  onPress={handleConfirm}
                  loading={sendMutation.isPending}
                  disabled={!canConfirm}
                  variant="secondary"
                  style={styles.actionButton}
                />
              </SSHStack>
            </>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

function destinationSource(draft: ArkDestinationDraft): string {
  if (draft.kind === 'arkoor') {
    return draft.address
  }
  if (draft.kind === 'bolt11') {
    return draft.invoice
  }
  if (draft.kind === 'lnaddress') {
    return draft.address
  }
  return draft.lnurl
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  actions: {
    marginTop: 16
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  destinationBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  monospace: {
    fontFamily: 'monospace'
  },
  totalRightColumn: {
    alignItems: 'flex-end'
  }
})
