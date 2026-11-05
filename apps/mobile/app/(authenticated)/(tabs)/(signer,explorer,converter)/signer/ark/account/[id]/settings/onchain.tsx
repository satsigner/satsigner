import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSWalletSourceRow from '@/components/SSWalletSourceRow'
import { PRIVACY_MASK } from '@/constants/privacy'
import { useArkBalance } from '@/hooks/useArkBalance'
import {
  useArkOnchainBalance,
  useArkOnchainSpendInFlight
} from '@/hooks/useArkBoard'
import {
  useArkOnchainSweep,
  useArkOnchainSweepPreview
} from '@/hooks/useArkOnchainSweep'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { Colors } from '@/styles'
import { getAccountTotalBalance } from '@/utils/account'
import { getAccountKindLabelFromAccount } from '@/utils/accountKindLabel'
import {
  type ArkOnchainSweepBlocker,
  getArkOnchainSweepBlocker,
  getArkSweepDestinations
} from '@/utils/arkOnchainSweep'
import { formatNumber } from '@/utils/format'

const BLOCKER_MESSAGE_KEYS: Record<
  Exclude<ArkOnchainSweepBlocker, 'loading'>,
  string
> = {
  belowDust: 'ark.onchain.sweep.error.belowDust',
  busy: 'ark.onchain.sweep.error.busy',
  empty: 'ark.onchain.sweep.error.empty',
  exitInProgress: 'ark.onchain.sweep.error.exitInProgress',
  noDestination: 'ark.onchain.sweep.error.noDestination'
}

function formatSats(amountSats: number, privacyMode: boolean): string {
  const amount = privacyMode ? PRIVACY_MASK : formatNumber(amountSats)
  return `${amount} ${t('bitcoin.sats')}`
}

export default function ArkOnchainWalletPage() {
  const { privacyMode } = useDisplayPreferences()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [account, autoBoardDisabled, setAutoBoardEnabled] = useArkStore(
    useShallow((state) => [
      state.accounts.find((arkAccount) => arkAccount.id === id),
      state.autoBoardDisabledIds.includes(id),
      state.setAutoBoardEnabled
    ])
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)

  const onchainBalanceQuery = useArkOnchainBalance(id)
  const arkBalanceQuery = useArkBalance(id)
  const previewQuery = useArkOnchainSweepPreview(id)
  const sweepMutation = useArkOnchainSweep(id)
  const spendInFlight = useArkOnchainSpendInFlight(id)
  const [pickedDestinationId, setPickedDestinationId] = useState<string>()

  const confirmedSats = onchainBalanceQuery.data?.confirmedSats ?? 0
  const pendingSats = onchainBalanceQuery.data?.pendingSats ?? 0
  const destinations = account
    ? getArkSweepDestinations(bitcoinAccounts, account.network)
    : []
  const destination =
    destinations.find((candidate) => candidate.id === pickedDestinationId) ??
    destinations[0]
  const preview = previewQuery.data
  const sweep = preview?.sweep
  const blocker = getArkOnchainSweepBlocker({
    hasDestination: !!destination,
    pendingExitSats: arkBalanceQuery.data?.pendingExitSats,
    spendInFlight,
    sweep
  })

  function handleToggleAutoBoard() {
    setAutoBoardEnabled(id, autoBoardDisabled)
  }

  function handleRetryPreview() {
    previewQuery.refetch()
  }

  function handleSweep() {
    if (!destination || !preview || blocker) {
      return
    }
    const sweepInput = {
      destinationAccountId: destination.id,
      feeRateSatPerVb: preview.feeRateSatPerVb
    }
    sweepMutation.mutate(sweepInput, {
      onError: (error) => {
        toast.error(`${t('ark.onchain.sweep.error.generic')}: ${error.message}`)
      },
      onSuccess: ({ amountSats, destinationName }) => {
        toast.success(
          t('ark.onchain.sweep.success', {
            amount: formatNumber(amountSats),
            name: destinationName,
            unit: t('bitcoin.sats')
          })
        )
      }
    })
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.onchain.title')}</SSText>
        }}
      />
      <SSScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSText color="muted" size="xs">
            {t('ark.onchain.description')}
          </SSText>

          <SSVStack gap="xs">
            <SSHStack justifyBetween style={styles.row}>
              <SSText color="muted" size="xs" uppercase>
                {t('ark.onchain.confirmed')}
              </SSText>
              <SSText size="sm">
                {formatSats(confirmedSats, privacyMode)}
              </SSText>
            </SSHStack>
            {pendingSats > 0 && (
              <SSHStack justifyBetween style={styles.row}>
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.onchain.unconfirmed')}
                </SSText>
                <SSText size="sm">
                  {formatSats(pendingSats, privacyMode)}
                </SSText>
              </SSHStack>
            )}
          </SSVStack>

          <SSCheckbox
            label={t('ark.onchain.autoBoard.label')}
            description={t('ark.onchain.autoBoard.description')}
            selected={!autoBoardDisabled}
            onPress={handleToggleAutoBoard}
          />

          <SSVStack gap="sm">
            <SSVStack gap="xxs">
              <SSText uppercase>{t('ark.onchain.sweep.title')}</SSText>
              <SSText color="muted" size="xs">
                {t('ark.onchain.sweep.description')}
              </SSText>
            </SSVStack>

            {destinations.map((candidate) => (
              <SSWalletSourceRow
                key={candidate.id}
                id={candidate.id}
                title={candidate.name}
                subtitle={getAccountKindLabelFromAccount(candidate)}
                availableSats={getAccountTotalBalance(candidate.summary)}
                privacyMode={privacyMode}
                selected={candidate.id === destination?.id}
                onSelect={setPickedDestinationId}
              />
            ))}

            {sweep?.ok && (
              <SSVStack gap="xxs">
                <SSHStack justifyBetween>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.onchain.sweep.amount')}
                  </SSText>
                  <SSText size="sm">
                    {formatSats(sweep.amountSats, privacyMode)}
                  </SSText>
                </SSHStack>
                <SSHStack justifyBetween>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.onchain.sweep.fee')}
                  </SSText>
                  <SSText size="xs">
                    {formatSats(sweep.feeSats, privacyMode)} ·{' '}
                    {preview?.feeRateSatPerVb} {t('bitcoin.satVb')}
                  </SSText>
                </SSHStack>
              </SSVStack>
            )}

            {previewQuery.error && (
              <SSText
                size="xs"
                style={{ color: Colors.warning }}
                onPress={handleRetryPreview}
              >
                {t('ark.onchain.sweep.error.preview')}
              </SSText>
            )}
            {blocker && blocker !== 'loading' && (
              <SSText size="xs" style={{ color: Colors.warning }}>
                {t(BLOCKER_MESSAGE_KEYS[blocker])}
              </SSText>
            )}
          </SSVStack>

          <SSButton
            label={
              destination
                ? t('ark.onchain.sweep.action', { name: destination.name })
                : t('ark.onchain.sweep.title')
            }
            onPress={handleSweep}
            loading={sweepMutation.isPending}
            disabled={!!blocker}
            variant="secondary"
          />
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  row: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8
  }
})
