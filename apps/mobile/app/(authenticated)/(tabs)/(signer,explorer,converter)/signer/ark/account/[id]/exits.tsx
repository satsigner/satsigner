import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSArkExitCard from '@/components/SSArkExitCard'
import SSArkExitClaimRecordCard from '@/components/SSArkExitClaimRecordCard'
import SSButton from '@/components/SSButton'
import SSDetailRow from '@/components/SSDetailRow'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSText from '@/components/SSText'
import SSWalletSourceRow from '@/components/SSWalletSourceRow'
import { useArkExitClaimFlow } from '@/hooks/useArkExitClaimFlow'
import { useArkExitFundingFlow } from '@/hooks/useArkExitFundingFlow'
import { useArkExits, useArkExitsRefresh } from '@/hooks/useArkExits'
import { useArkWallet } from '@/hooks/useArkWallet'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { getAccountTotalBalance } from '@/utils/account'
import { getAccountKindLabelFromAccount } from '@/utils/accountKindLabel'
import {
  type ArkExitClaimBlocker,
  type ArkExitClaimFeeSpeed,
  sortArkExits
} from '@/utils/arkExit'
import { setClipboard } from '@/utils/clipboard'
import { formatMaskedSats } from '@/utils/format'

const BLOCKER_MESSAGE_KEYS: Record<
  Exclude<ArkExitClaimBlocker, 'loading'>,
  string
> = {
  claimInProgress: 'ark.exit.claim.blocker.claimInProgress',
  noDestination: 'ark.exit.claim.blocker.noDestination',
  nothingClaimable: 'ark.exit.claim.blocker.nothingClaimable'
}

function ArkExitsHeaderTitle() {
  return <SSText uppercase>{t('ark.exit.title')}</SSText>
}

const SCREEN_OPTIONS = { headerTitle: ArkExitsHeaderTitle }

async function handleCopyTxid(txid: string) {
  const copied = await setClipboard(txid)
  if (copied) {
    toast.success(t('common.copiedToClipboard'))
  }
}

export default function ArkExitsPage() {
  const { privacyMode } = useDisplayPreferences()
  const { id } = useLocalSearchParams<{ id: string }>()
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)

  const walletQuery = useArkWallet(id)
  const exitsQuery = useArkExits(id)
  const refreshExits = useArkExitsRefresh(id)
  const exits = exitsQuery.data
  const sortedExits = sortArkExits(exits ?? [])
  const {
    blocker,
    claimBusy,
    claimMutation,
    claimable,
    claimableSats,
    claims,
    destination,
    destinations,
    discardMutation,
    feeRate,
    feeRatesQuery,
    feeSpeed,
    preview,
    previewQuery,
    retryMutation,
    selectDestination,
    selectFeeSpeed,
    submission
  } = useArkExitClaimFlow(id, exits)
  const funding = useArkExitFundingFlow(id, exits)

  const [refreshing, setRefreshing] = useState(false)
  const loading = walletQuery.isLoading || exitsQuery.isLoading

  function destinationName(accountId: string) {
    return bitcoinAccounts.find((candidate) => candidate.id === accountId)?.name
  }

  async function handleRefresh() {
    setRefreshing(true)
    await (walletQuery.error ? walletQuery.refetch() : refreshExits())
    setRefreshing(false)
  }

  function handleRetryPreview() {
    previewQuery.refetch()
  }

  function handleRetryFeeRates() {
    feeRatesQuery.refetch()
  }

  function handleClaim() {
    if (!submission) {
      return
    }
    claimMutation.mutate(submission, {
      onError: (error) => {
        toast.error(`${t('ark.exit.claim.error.generic')}: ${error.message}`)
      },
      onSuccess: ({ amountSats, destinationName: name }) => {
        toast.success(
          t('ark.exit.claim.success', {
            amount: formatMaskedSats(amountSats, privacyMode),
            name
          })
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
    if (!funding.fundingInput) {
      return
    }
    funding.fundingMutation.mutate(funding.fundingInput, {
      onError: (error) => {
        toast.error(`${t('ark.exit.funding.error.generic')}: ${error.message}`)
      }
    })
  }

  return (
    <SSMainLayout>
      <Stack.Screen options={SCREEN_OPTIONS} />
      <SSScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.white}
          />
        }
      >
        <SSVStack gap="lg" style={styles.container}>
          <SSText color="muted" size="xs">
            {t('ark.exit.description')}
          </SSText>

          {loading && (
            <SSText color="muted" size="sm" center>
              {t('common.loading')}
            </SSText>
          )}
          {walletQuery.error && (
            <SSText
              size="sm"
              center
              style={styles.warningText}
              onPress={handleRefresh}
            >
              {t('ark.error.walletLoad')}
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

          {funding.error && (
            <SSText
              size="sm"
              center
              style={styles.warningText}
              onPress={funding.retry}
            >
              {t('ark.exit.funding.error.estimate', {
                reason: funding.error.message
              })}
            </SSText>
          )}

          {funding.shortfallSats > 0 && (
            <SSVStack gap="sm" style={styles.panel}>
              <SSVStack gap="xxs">
                <SSText uppercase>{t('ark.exit.funding.title')}</SSText>
                <SSText size="sm" style={styles.warningText}>
                  {t('ark.exit.funding.description', {
                    amount: formatMaskedSats(funding.shortfallSats, privacyMode)
                  })}
                </SSText>
              </SSVStack>
              {funding.sources.length === 0 && (
                <SSText color="muted" size="xs">
                  {t('ark.exit.funding.noSource')}
                </SSText>
              )}
              {funding.sources.map((source) => (
                <SSWalletSourceRow
                  key={source.id}
                  id={source.id}
                  title={source.name}
                  subtitle={getAccountKindLabelFromAccount(source)}
                  availableSats={getAccountTotalBalance(source.summary)}
                  privacyMode={privacyMode}
                  selected={source.id === funding.source?.id}
                  onSelect={funding.selectSource}
                />
              ))}
              {funding.source && (
                <SSButton
                  label={t('ark.exit.funding.action', {
                    amount: formatMaskedSats(funding.amountSats, privacyMode),
                    name: funding.source.name
                  })}
                  onPress={handleFund}
                  loading={funding.fundingMutation.isPending}
                  variant="secondary"
                />
              )}
            </SSVStack>
          )}

          {funding.incomingSats > 0 && (
            <SSVStack gap="xxs" style={styles.panel}>
              <SSText uppercase>{t('ark.exit.funding.confirmingTitle')}</SSText>
              <SSText color="muted" size="sm">
                {t('ark.exit.funding.confirmingDescription', {
                  amount: formatMaskedSats(funding.incomingSats, privacyMode)
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
                  destinationName={destinationName(record.destinationAccountId)}
                  privacyMode={privacyMode}
                  retrying={
                    retryMutation.isPending &&
                    retryMutation.variables === record.txid
                  }
                  discarding={
                    discardMutation.isPending &&
                    discardMutation.variables === record.txid
                  }
                  disabled={claimBusy}
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
                    amount: formatMaskedSats(claimableSats, privacyMode),
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
                  onSelect={selectDestination}
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
                  onChange={selectFeeSpeed}
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
                    value={formatMaskedSats(
                      preview.amountSats + preview.feeSats,
                      privacyMode
                    )}
                  />
                  <SSDetailRow
                    label={t('ark.exit.claim.fee')}
                    value={`${formatMaskedSats(preview.feeSats, privacyMode)} · ${feeRate} ${t('bitcoin.satVb')}`}
                  />
                  <SSDetailRow
                    label={t('ark.exit.claim.receive')}
                    value={formatMaskedSats(preview.amountSats, privacyMode)}
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
                disabled={!submission}
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
