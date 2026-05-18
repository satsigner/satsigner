import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkSendFeeEstimate } from '@/hooks/useArkSendFeeEstimate'
import { useArkWallet } from '@/hooks/useArkWallet'
import { useArkZapPay } from '@/hooks/useArkZapPay'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { usePriceStore } from '@/store/price'
import { useZapFlowStore } from '@/store/zapFlow'
import { Colors } from '@/styles'
import { truncateArkCounterparty } from '@/utils/arkMovement'
import { getBolt11Network } from '@/utils/bolt11Network'
import { formatFiatPrice, formatNumber } from '@/utils/format'

const INVOICE_TRUNCATE_CHARS = 14

type PayInvoiceParams = {
  id: string
  invoice: string
  amountSats: string
}

export default function ArkPayInvoicePage() {
  const router = useRouter()
  const {
    id,
    invoice,
    amountSats: amountSatsParam
  } = useLocalSearchParams<PayInvoiceParams>()

  const amountSats = Number.parseInt(amountSatsParam ?? '0', 10) || 0

  const account = useArkStore((state) =>
    state.accounts.find((a) => a.id === id)
  )
  const walletQuery = useArkWallet(id)
  const balanceQuery = useArkBalance(id)
  const payMutation = useArkZapPay(id)

  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const debouncedAmountSats = useDebouncedValue(amountSats)
  const feeEstimateQuery = useArkSendFeeEstimate({
    accountId: id,
    amountSats: debouncedAmountSats,
    kind: 'lightning'
  })

  const spendableSats = balanceQuery.data?.spendableSats ?? 0
  const feeSats = feeEstimateQuery.data?.feeSats
  const totalSats = feeSats !== undefined ? amountSats + feeSats : undefined
  const exceedsBalance =
    totalSats !== undefined
      ? totalSats > spendableSats
      : amountSats > spendableSats

  const invoiceNetwork = invoice ? getBolt11Network(invoice) : null
  const networkValid =
    !invoice || !account ? true : invoiceNetwork === account.network

  const canConfirm =
    Boolean(invoice) &&
    amountSats > 0 &&
    !exceedsBalance &&
    networkValid &&
    !payMutation.isPending &&
    !walletQuery.isPending

  function handleCancel() {
    useZapFlowStore.getState().setZapResult('cancelled')
    router.back()
  }

  function handleConfirm() {
    if (!invoice || amountSats <= 0) {
      return
    }
    payMutation.mutate(
      { amountSats, invoice },
      {
        onError: (error) => {
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(`${t('ark.send.error.generic')}: ${reason}`)
        },
        onSuccess: () => {
          router.back()
        }
      }
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.pay.title')}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg" style={styles.container}>
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.pay.zapLabel')}
            </SSText>
            {invoice ? (
              <View style={styles.destinationBox}>
                <SSClipboardCopy text={invoice}>
                  <SSText size="sm" style={styles.monospace}>
                    {truncateArkCounterparty(invoice, INVOICE_TRUNCATE_CHARS)}
                  </SSText>
                </SSClipboardCopy>
              </View>
            ) : (
              <SSText size="xs" style={{ color: Colors.warning }}>
                {t('ark.send.error.invalidDestination')}
              </SSText>
            )}
            {!networkValid && (
              <SSText size="xs" style={{ color: Colors.warning }}>
                {t('ark.send.error.addressNetworkMismatch')}
              </SSText>
            )}
          </SSVStack>
          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.send.amount')} ({t('bitcoin.sats')})
            </SSText>
            <SSText size="lg">{formatNumber(amountSats)}</SSText>
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
            {exceedsBalance && !payMutation.isPending && (
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
                        {formatFiatPrice(totalSats, btcPrice)} {fiatCurrency}
                      </SSText>
                    )}
                  </SSVStack>
                </SSHStack>
              )}
            </SSVStack>
          )}
          <SSHStack gap="sm" style={styles.actions}>
            <SSButton
              label={t('common.cancel')}
              onPress={handleCancel}
              variant="ghost"
              style={styles.actionButton}
              disabled={payMutation.isPending}
            />
            <SSButton
              label={t('ark.pay.confirm')}
              onPress={handleConfirm}
              loading={payMutation.isPending || walletQuery.isPending}
              disabled={!canConfirm}
              variant="secondary"
              style={styles.actionButton}
            />
          </SSHStack>
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
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
