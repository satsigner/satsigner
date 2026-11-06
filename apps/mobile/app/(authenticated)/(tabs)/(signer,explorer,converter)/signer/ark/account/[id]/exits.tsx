import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSArkExitCard from '@/components/SSArkExitCard'
import SSArkExitClaimRecordCard from '@/components/SSArkExitClaimRecordCard'
import SSButton from '@/components/SSButton'
import SSDetailRow from '@/components/SSDetailRow'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSText from '@/components/SSText'
import SSWalletSourceRow from '@/components/SSWalletSourceRow'
import { useArkExitFeeEstimate } from '@/hooks/useArkExitFeeEstimate'
import {
  useArkExitClaim,
  useArkExitClaimPreview,
  useArkExitClaimDiscard,
  useArkExitClaimRetry,
  useArkExitClaims,
  useArkExitFunding,
  useArkExits,
  useArkExitsRefresh,
  useArkOnchainFeeRates
} from '@/hooks/useArkExits'
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
  type ArkExitClaimBlocker,
  type ArkExitClaimFeeSpeed,
  getArkExitClaimBlocker,
  getArkExitClaimFeeRate,
  getArkExitFundingAmount,
  getArkExitFundingSources,
  getClaimableArkExits,
  getUnconfirmedArkExits,
  sortArkExits,
  sumArkExitSats
} from '@/utils/arkExit'
import { getArkSweepDestinations } from '@/utils/arkOnchainSweep'
import { setClipboard } from '@/utils/clipboard'
import { formatMaskedNumber } from '@/utils/format'

const BLOCKER_MESSAGE_KEYS: Record<
  Exclude<ArkExitClaimBlocker, 'loading'>,
  string
> = {
  claimInProgress: 'ark.exit.claim.blocker.claimInProgress',
  noDestination: 'ark.exit.claim.blocker.noDestination',
  nothingClaimable: 'ark.exit.claim.blocker.nothingClaimable'
}

const DEFAULT_FEE_SPEED: ArkExitClaimFeeSpeed = 'regular'

export default function ArkExitsPage() {
  const { privacyMode } = useDisplayPreferences()
  const { id } = useLocalSearchParams<{ id: string }>()
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === id))
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)

  const exitsQuery = useArkExits(id)
  const claims = useArkExitClaims(id)
  const feeRatesQuery = useArkOnchainFeeRates(id)
  const claimMutation = useArkExitClaim(id)
  const retryMutation = useArkExitClaimRetry(id)
  const discardMutation = useArkExitClaimDiscard(id)
  const fundingMutation = useArkExitFunding(id)
  const refreshExits = useArkExitsRefresh(id)

  const [pickedDestinationId, setPickedDestinationId] = useState<string>()
  const [pickedFundingId, setPickedFundingId] = useState<string>()
  const [feeSpeed, setFeeSpeed] =
    useState<ArkExitClaimFeeSpeed>(DEFAULT_FEE_SPEED)

  const unit = t('bitcoin.sats')
  const exits = exitsQuery.data
  const sortedExits = sortArkExits(exits ?? [])
  const claimable = getClaimableArkExits(exits ?? [])
  const claimableSats = sumArkExitSats(claimable)
  const unconfirmedIds = getUnconfirmedArkExits(exits ?? []).map(
    (exit) => exit.vtxoId
  )

  const destinations = account
    ? getArkSweepDestinations(bitcoinAccounts, account.network)
    : []
  const destination =
    destinations.find((candidate) => candidate.id === pickedDestinationId) ??
    destinations[0]
  const feeRate = getArkExitClaimFeeRate(feeRatesQuery.data, feeSpeed)
  const blocker = getArkExitClaimBlocker({
    exits,
    hasDestination: !!destination,
    pendingClaims: claims
  })
  const previewQuery = useArkExitClaimPreview(
    !blocker && destination && feeRate !== undefined
      ? {
          arkAccountId: id,
          destinationAccountId: destination.id,
          feeRateSatPerVb: feeRate
        }
      : undefined
  )
  const preview = previewQuery.isPlaceholderData ? undefined : previewQuery.data
  const canClaim =
    !blocker && !!preview && feeRate !== undefined && !claimMutation.isPending

  const feeEstimateQuery = useArkExitFeeEstimate({
    accountId: id,
    enabled: unconfirmedIds.length > 0,
    poll: true,
    vtxoIds: unconfirmedIds
  })
  const shortfallSats = feeEstimateQuery.data?.shortfallSats ?? 0
  const incomingFundingSats = feeEstimateQuery.data?.fundingConfirming
    ? feeEstimateQuery.data.onchainPendingSats
    : 0
  const fundingAmountSats = getArkExitFundingAmount(shortfallSats)
  const fundingSources = account
    ? getArkExitFundingSources(bitcoinAccounts, account.network)
    : []
  const fundingSource =
    fundingSources.find((source) => source.id === pickedFundingId) ??
    fundingSources[0]

  function satsLabel(amountSats: number) {
    return `${formatMaskedNumber(amountSats, privacyMode)} ${unit}`
  }

  function destinationName(accountId: string) {
    return bitcoinAccounts.find((candidate) => candidate.id === accountId)
      ?.name
  }

  async function handleCopyTxid(txid: string) {
    const copied = await setClipboard(txid)
    if (copied) {
      toast.success(t('common.copiedToClipboard'))
    }
  }

  function handleRefresh() {
    refreshExits()
  }

  function handleRetryPreview() {
    previewQuery.refetch()
  }

  function handleRetryFeeRates() {
    feeRatesQuery.refetch()
  }

  function handleRetryFeeEstimate() {
    feeEstimateQuery.refetch()
  }

  function handleClaim() {
    if (!canClaim || !destination || !preview || feeRate === undefined) {
      return
    }
    const submission = {
      approved: preview,
      arkAccountId: id,
      destinationAccountId: destination.id,
      feeRateSatPerVb: feeRate
    }
    claimMutation.mutate(submission, {
      onError: (error) => {
        toast.error(`${t('ark.exit.claim.error.generic')}: ${error.message}`)
      },
      onSuccess: ({ amountSats, destinationName: name }) => {
        toast.success(
          t('ark.exit.claim.success', { amount: satsLabel(amountSats), name })
        )
      }
    })
  }

  function handleRetryClaim(txid: string) {
    retryMutation.mutate(txid, {
      onError: (error) => {
        toast.error(`${t('ark.exit.claim.error.broadcast')}: ${error.message}`)
      },
      onSuccess: () => {
        toast.success(t('ark.exit.claim.record.retried'))
      }
    })
  }

  function handleDiscardClaim(txid: string) {
    discardMutation.mutate(txid, {
      onError: (error) => {
        toast.error(`${t('ark.exit.claim.error.discard')}: ${error.message}`)
      }
    })
  }

  function handleFund() {
    if (!fundingSource) {
      return
    }
    const fundingInput = {
      amountSats: fundingAmountSats,
      fundingAccountId: fundingSource.id
    }
    fundingMutation.mutate(fundingInput, {
      onError: (error) => {
        toast.error(`${t('ark.exit.funding.error.generic')}: ${error.message}`)
      }
    })
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.exit.title')}</SSText>
        }}
      />
      <SSScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={exitsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={Colors.white}
          />
        }
      >
        <SSVStack gap="lg" style={styles.container}>
          <SSText color="muted" size="xs">
            {t('ark.exit.description')}
          </SSText>

          {exitsQuery.isLoading && (
            <SSText color="muted" size="sm" center>
              {t('common.loading')}
            </SSText>
          )}
          {exitsQuery.error && (
            <SSText
              size="sm"
              center
              style={styles.warningText}
              onPress={handleRefresh}
            >
              {t('ark.exit.loadError')}
            </SSText>
          )}

          {feeEstimateQuery.error && (
            <SSText
              size="sm"
              center
              style={styles.warningText}
              onPress={handleRetryFeeEstimate}
            >
              {t('ark.exit.funding.error.estimate', {
                reason: feeEstimateQuery.error.message
              })}
            </SSText>
          )}

          {shortfallSats > 0 && (
            <SSVStack gap="sm" style={styles.panel}>
              <SSVStack gap="xxs">
                <SSText uppercase>{t('ark.exit.funding.title')}</SSText>
                <SSText size="sm" style={styles.warningText}>
                  {t('ark.exit.funding.description', {
                    amount: satsLabel(shortfallSats)
                  })}
                </SSText>
              </SSVStack>
              {fundingSources.length === 0 && (
                <SSText color="muted" size="xs">
                  {t('ark.exit.funding.noSource')}
                </SSText>
              )}
              {fundingSources.map((source) => (
                <SSWalletSourceRow
                  key={source.id}
                  id={source.id}
                  title={source.name}
                  subtitle={getAccountKindLabelFromAccount(source)}
                  availableSats={getAccountTotalBalance(source.summary)}
                  privacyMode={privacyMode}
                  selected={source.id === fundingSource?.id}
                  onSelect={setPickedFundingId}
                />
              ))}
              {fundingSource && (
                <SSButton
                  label={t('ark.exit.funding.action', {
                    amount: satsLabel(fundingAmountSats),
                    name: fundingSource.name
                  })}
                  onPress={handleFund}
                  loading={fundingMutation.isPending}
                  variant="secondary"
                />
              )}
            </SSVStack>
          )}

          {incomingFundingSats > 0 && (
            <SSVStack gap="xxs" style={styles.panel}>
              <SSText uppercase>{t('ark.exit.funding.confirmingTitle')}</SSText>
              <SSText color="muted" size="sm">
                {t('ark.exit.funding.confirmingDescription', {
                  amount: satsLabel(incomingFundingSats)
                })}
              </SSText>
            </SSVStack>
          )}

          {claims.length > 0 && (
            <SSVStack gap="sm">
              <SSText uppercase>{t('ark.exit.claim.record.section')}</SSText>
              {claims.map((record) => (
                <SSArkExitClaimRecordCard
                  key={record.txid}
                  record={record}
                  destinationName={destinationName(
                    record.destinationAccountId
                  )}
                  privacyMode={privacyMode}
                  retrying={
                    retryMutation.isPending &&
                    retryMutation.variables === record.txid
                  }
                  discarding={
                    discardMutation.isPending &&
                    discardMutation.variables === record.txid
                  }
                  onRetry={handleRetryClaim}
                  onDiscard={handleDiscardClaim}
                  onCopyTxid={handleCopyTxid}
                />
              ))}
            </SSVStack>
          )}

          {claimable.length > 0 && (
            <SSVStack gap="sm" style={styles.panel}>
              <SSVStack gap="xxs">
                <SSText uppercase>{t('ark.exit.claim.title')}</SSText>
                <SSText color="muted" size="xs">
                  {t('ark.exit.claim.description', {
                    amount: satsLabel(claimableSats),
                    count: claimable.length
                  })}
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

              {feeRatesQuery.data && (
                <SSPairedTabs<ArkExitClaimFeeSpeed>
                  activeTab={feeSpeed}
                  primary={{
                    key: 'slow',
                    label: t('ark.exit.claim.speed.slow', {
                      rate: feeRatesQuery.data.slowSatPerVb
                    })
                  }}
                  secondary={{
                    key: 'regular',
                    label: t('ark.exit.claim.speed.regular', {
                      rate: feeRatesQuery.data.regularSatPerVb
                    })
                  }}
                  tertiary={{
                    key: 'fast',
                    label: t('ark.exit.claim.speed.fast', {
                      rate: feeRatesQuery.data.fastSatPerVb
                    })
                  }}
                  onChange={setFeeSpeed}
                />
              )}
              {feeRatesQuery.error && (
                <SSText
                  size="xs"
                  style={styles.warningText}
                  onPress={handleRetryFeeRates}
                >
                  {t('ark.exit.claim.error.feeRates', {
                    reason: feeRatesQuery.error.message
                  })}
                </SSText>
              )}

              {preview && (
                <View>
                  <SSDetailRow
                    label={t('ark.exit.claim.exited')}
                    value={satsLabel(preview.amountSats + preview.feeSats)}
                  />
                  <SSDetailRow
                    label={t('ark.exit.claim.fee')}
                    value={`${satsLabel(preview.feeSats)} · ${feeRate} ${t('bitcoin.satVb')}`}
                  />
                  <SSDetailRow
                    label={t('ark.exit.claim.receive')}
                    value={satsLabel(preview.amountSats)}
                  />
                </View>
              )}
              {preview && preview.skippedCount > 0 && (
                <SSText color="muted" size="xs">
                  {t('ark.exit.claim.skipped', { count: preview.skippedCount })}
                </SSText>
              )}
              {previewQuery.isFetching && !preview && (
                <SSText color="muted" size="xs">
                  {t('ark.exit.claim.previewLoading')}
                </SSText>
              )}
              {previewQuery.error && (
                <SSText
                  size="xs"
                  style={styles.warningText}
                  onPress={handleRetryPreview}
                >
                  {t('ark.exit.claim.error.preview', {
                    reason: previewQuery.error.message
                  })}
                </SSText>
              )}
              {blocker && blocker !== 'loading' && (
                <SSText size="xs" style={styles.warningText}>
                  {t(BLOCKER_MESSAGE_KEYS[blocker])}
                </SSText>
              )}

              <SSButton
                label={
                  destination
                    ? t('ark.exit.claim.action', { name: destination.name })
                    : t('ark.exit.claim.title')
                }
                onPress={handleClaim}
                loading={claimMutation.isPending}
                disabled={!canClaim}
                variant="secondary"
              />
            </SSVStack>
          )}

          {exits && exits.length === 0 && (
            <SSVStack gap="xs" itemsCenter style={styles.empty}>
              <SSText uppercase>{t('ark.exit.empty.title')}</SSText>
              <SSText color="muted" size="xs" center>
                {t('ark.exit.empty.description')}
              </SSText>
            </SSVStack>
          )}

          {sortedExits.length > 0 && (
            <SSVStack gap="sm">
              <SSHStack justifyBetween>
                <SSText uppercase>{t('ark.exit.list.title')}</SSText>
                <SSText color="muted" size="xs">
                  {sortedExits.length}
                </SSText>
              </SSHStack>
              {sortedExits.map((exit) => (
                <SSArkExitCard
                  key={exit.vtxoId}
                  exit={exit}
                  privacyMode={privacyMode}
                  onCopyTxid={handleCopyTxid}
                />
              ))}
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
  },
  empty: {
    paddingVertical: 32
  },
  panel: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  warningText: {
    color: Colors.warning
  }
})
