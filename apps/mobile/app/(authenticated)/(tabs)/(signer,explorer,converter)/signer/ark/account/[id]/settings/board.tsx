import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, View, type ViewInstance } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSLoader from '@/components/SSLoader'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSShareableQR from '@/components/SSShareableQR'
import SSShareButton from '@/components/SSShareButton'
import SSText from '@/components/SSText'
import SSWalletSourceRow from '@/components/SSWalletSourceRow'
import { DUST_LIMIT } from '@/constants/btc'
import {
  useArkBoardMutation,
  useArkOnchainAddress,
  useArkOnchainBalance,
  useArkPendingBoards,
  useArkServerInfo
} from '@/hooks/useArkBoard'
import { useArkBoardDeposit } from '@/hooks/useArkBoardDeposit'
import { useArkBoardFromAccount } from '@/hooks/useArkBoardFromAccount'
import { useArkBoardPayjoin } from '@/hooks/useArkBoardPayjoin'
import { useArkFeeEstimate } from '@/hooks/useArkFeeEstimate'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors, Typography } from '@/styles'
import { getAccountKindLabel } from '@/utils/accountKindLabel'
import {
  type ArkBoardValidationReason,
  validateBoardAmount
} from '@/utils/arkBoard'
import {
  matchingUnbroadcastBoardTxid,
  txidFromSignedDraft
} from '@/utils/arkBoardDeposit'
import {
  type ArkBoardSource,
  getArkBoardSources,
  resolveArkBoardSource
} from '@/utils/arkBoardSource'
import { setClipboard } from '@/utils/clipboard'
import { formatNumber, formatTxId } from '@/utils/format'

const DEPOSIT_QR_SIZE = 200
const PAYJOIN_LOADER_SIZE = 18

type BoardTab = 'wallet' | 'address' | 'payjoin'

const VALIDATION_ERROR_KEYS: Record<ArkBoardValidationReason, string> = {
  belowMinimum: 'ark.board.error.belowMinimum',
  insufficientFunds: 'ark.board.error.insufficientFunds',
  invalidAmount: 'ark.board.error.invalidAmount'
}

function sourceTitle(source: ArkBoardSource): string {
  return source.kind === 'boardingWallet'
    ? t('ark.board.fromWallet.boardingWallet')
    : source.name
}

function sourceSubtitle(source: ArkBoardSource): string {
  if (source.kind === 'boardingWallet') {
    return t('ark.board.fromWallet.boardingWalletHint')
  }
  return getAccountKindLabel(source)
}

export default function ArkBoardPage() {
  const { btcPrice, fiatCurrency, fiatEnabled, privacyMode } =
    useDisplayPreferences()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === id))
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)

  const balanceQuery = useArkOnchainBalance(id)
  const addressQuery = useArkOnchainAddress(id)
  const pendingBoardsQuery = useArkPendingBoards(id)
  const serverInfoQuery = useArkServerInfo(id)
  const boardMutation = useArkBoardMutation(id)
  const boardFromAccount = useArkBoardFromAccount(id)
  const { linkedAccount, resumeLinkedBroadcast } = useArkBoardDeposit(account)
  const boardPayjoin = useArkBoardPayjoin(account)
  const [
    builderAccountId,
    builderBroadcasted,
    builderDrafts,
    builderSignedPsbtBase64,
    builderSignedTx
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.accountId,
      state.broadcasted,
      state.drafts,
      state.signedPsbtBase64,
      state.signedTx
    ])
  )

  const [amountSats, setAmountSats] = useState(0)
  const [tab, setTab] = useState<BoardTab>('wallet')
  const [pickedSourceId, setPickedSourceId] = useState<string>()
  const qrRef = useRef<ViewInstance>(null)

  const confirmedSats = balanceQuery.data?.confirmedSats ?? 0
  const pendingSats = balanceQuery.data?.pendingSats ?? 0
  const minBoardAmountSats = serverInfoQuery.data?.minBoardAmountSats
  const requiredConfirmations = serverInfoQuery.data?.requiredBoardConfirmations
  const pendingBoards = pendingBoardsQuery.data ?? []
  const depositAddress = addressQuery.data
  const activeTab =
    tab === 'payjoin' && !boardPayjoin.available ? 'address' : tab
  const savedLinkedDraft = linkedAccount
    ? builderDrafts[linkedAccount.id]
    : undefined
  const resumeTxid = matchingUnbroadcastBoardTxid({
    activeAccountId: builderAccountId,
    activeBroadcasted: builderBroadcasted,
    activeTxid: txidFromSignedDraft(builderSignedPsbtBase64, builderSignedTx),
    linkedAccountId: linkedAccount?.id,
    pendingTxids: pendingBoards.map((pendingBoard) => pendingBoard.txid),
    savedDraftTxid: txidFromSignedDraft(
      savedLinkedDraft?.signedPsbtBase64,
      savedLinkedDraft?.signedTx
    )
  })
  const showResumeBroadcast = !!resumeTxid && !!linkedAccount

  const minAmountSats = Math.max(DUST_LIMIT, minBoardAmountSats ?? 0)
  const sources = account
    ? getArkBoardSources({
        accounts: bitcoinAccounts,
        boardingWalletSats: confirmedSats,
        network: account.network
      })
    : []
  const selectedSource = resolveArkBoardSource(
    sources,
    pickedSourceId,
    minAmountSats
  )
  const availableSats = selectedSource?.availableSats ?? 0
  const canEnterAmount = availableSats >= minAmountSats
  const validation = validateBoardAmount({
    amountSats,
    availableSats,
    minBoardAmountSats
  })
  const fromBoardingWallet = selectedSource?.kind === 'boardingWallet'
  const fromAccount = selectedSource?.kind === 'account'
  const boardAll =
    fromBoardingWallet && validation.valid ? amountSats >= availableSats : false
  const showMainnetWarning = fromAccount && account?.network === 'bitcoin'
  const showExternalSignerWarning =
    selectedSource?.kind === 'account' &&
    selectedSource.policyType !== 'singlesig'

  const feeQuery = useArkFeeEstimate({
    accountId: id,
    enabled: validation.valid && activeTab === 'wallet',
    request: { amountSats, kind: 'board' }
  })
  const feeSats = feeQuery.data?.feeSats
  const busy = boardMutation.isPending || boardFromAccount.isPending
  const canSubmit =
    !!selectedSource && validation.valid && !busy && feeSats !== undefined

  async function handleCopyAddress() {
    if (!depositAddress) {
      return
    }
    const copied = await setClipboard(depositAddress)
    if (copied) {
      toast.success(t('common.copiedToClipboard'))
      return
    }
    toast.error(t('common.copyFailed'))
  }

  async function handleCopyPayjoinUri() {
    if (!boardPayjoin.payjoinUri) {
      return
    }
    const copied = await setClipboard(boardPayjoin.payjoinUri)
    if (copied) {
      toast.success(t('common.copiedToClipboard'))
      return
    }
    toast.error(t('common.copyFailed'))
  }

  function handleRestartPayjoin() {
    boardPayjoin.restart()
  }

  function handleCancel() {
    router.back()
  }

  function handleRetryBalance() {
    balanceQuery.refetch()
  }

  function handleRetryAddress() {
    addressQuery.refetch()
  }

  function handleRetryFee() {
    feeQuery.refetch()
  }

  function boardFromBoardingWallet() {
    boardMutation.mutate(
      { amountSats: boardAll ? undefined : amountSats },
      {
        onError: (error) => {
          toast.error(`${t('ark.board.error.generic')}: ${error.message}`)
        },
        onSuccess: () => {
          toast.success(t('ark.board.success'))
          router.dismissTo({
            params: { id },
            pathname: '/signer/ark/account/[id]'
          })
        }
      }
    )
  }

  function handleSubmit() {
    if (!selectedSource) {
      return
    }
    if (!validation.valid) {
      toast.error(t(VALIDATION_ERROR_KEYS[validation.reason]))
      return
    }
    if (selectedSource.kind === 'boardingWallet') {
      boardFromBoardingWallet()
      return
    }
    boardFromAccount.mutate(
      { amountSats, fundingAccountId: selectedSource.id },
      {
        onError: (error) => {
          toast.error(
            `${t('ark.board.fromWallet.error.prepare')}: ${error.message}`
          )
        }
      }
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.board.title')}</SSText>
        }}
      />
      <SSScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSPairedTabs<BoardTab>
            activeTab={activeTab}
            primary={{ key: 'wallet', label: t('ark.board.walletTab') }}
            secondary={{ key: 'address', label: t('ark.board.addressTab') }}
            tertiary={
              boardPayjoin.available
                ? { key: 'payjoin', label: t('ark.board.payjoinTab') }
                : undefined
            }
            onChange={setTab}
          />

          {activeTab === 'wallet' ? (
            <SSVStack gap="lg">
              <SSText color="muted" size="xs">
                {t('ark.board.fromWallet.description')}
              </SSText>

              <SSVStack gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.board.fromWallet.source')}
                </SSText>
                {balanceQuery.error && !balanceQuery.isLoading && (
                  <SSText
                    size="xs"
                    style={{ color: Colors.warning }}
                    onPress={handleRetryBalance}
                  >
                    {t('ark.board.error.loadBalance')}
                  </SSText>
                )}
                {sources.length === 0 ? (
                  <SSText color="muted" size="xs">
                    {t('ark.board.fromWallet.empty')}
                  </SSText>
                ) : (
                  sources.map((source) => (
                    <SSWalletSourceRow
                      key={source.id}
                      id={source.id}
                      title={sourceTitle(source)}
                      subtitle={sourceSubtitle(source)}
                      availableSats={source.availableSats}
                      privacyMode={privacyMode}
                      selected={source.id === selectedSource?.id}
                      onSelect={setPickedSourceId}
                    />
                  ))
                )}
              </SSVStack>

              {selectedSource ? (
                <SSVStack gap="xs">
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.board.amount')}
                  </SSText>
                  {minBoardAmountSats !== undefined && (
                    <SSText color="muted" size="xs">
                      {t('ark.board.minAmount', {
                        amount: formatNumber(minAmountSats),
                        unit: t('bitcoin.sats')
                      })}
                    </SSText>
                  )}
                  {canEnterAmount ? (
                    <SSVStack gap="sm">
                      <SSAmountInput
                        btcPrice={btcPrice}
                        fiatCurrency={fiatCurrency}
                        fiatEnabled={fiatEnabled}
                        privacyMode={privacyMode}
                        min={minAmountSats}
                        max={availableSats}
                        value={amountSats}
                        onValueChange={setAmountSats}
                      />
                      {amountSats > 0 && !validation.valid && (
                        <SSText size="xs" style={{ color: Colors.warning }}>
                          {t(VALIDATION_ERROR_KEYS[validation.reason])}
                        </SSText>
                      )}
                      {validation.valid && (
                        <SSVStack gap="xxs">
                          <SSHStack justifyBetween>
                            <SSText color="muted" size="xs" uppercase>
                              {t('ark.board.fee')}
                            </SSText>
                            {feeSats !== undefined ? (
                              <SSText size="xs">
                                {formatNumber(feeSats)} {t('bitcoin.sats')}
                              </SSText>
                            ) : feeQuery.isPending ? (
                              <SSText color="muted" size="xs">
                                {t('ark.board.feeEstimating')}
                              </SSText>
                            ) : feeQuery.error ? (
                              <SSText
                                size="xs"
                                style={{ color: Colors.warning }}
                                onPress={handleRetryFee}
                              >
                                {t('ark.board.feeUnavailable')}
                              </SSText>
                            ) : null}
                          </SSHStack>
                          {fromAccount && (
                            <SSText color="muted" size="xs">
                              {t('ark.board.fromWallet.feeHint')}
                            </SSText>
                          )}
                        </SSVStack>
                      )}
                    </SSVStack>
                  ) : (
                    <SSText color="muted" size="xs">
                      {t('ark.board.error.insufficientFunds')}
                    </SSText>
                  )}
                </SSVStack>
              ) : null}

              {showMainnetWarning && (
                <SSText size="xs" style={{ color: Colors.warning }}>
                  {t('ark.board.fromWallet.mainnetWarning')}
                </SSText>
              )}
              {showExternalSignerWarning && (
                <SSText size="xs" style={{ color: Colors.warning }}>
                  {t('ark.board.fromWallet.externalSignerWarning')}
                </SSText>
              )}
            </SSVStack>
          ) : null}

          {activeTab === 'address' ? (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs">
                {t('ark.board.depositDescription')}
              </SSText>
              {pendingSats > 0 && (
                <SSText color="muted" size="xs">
                  {t('ark.board.balancePendingHint', {
                    amount: formatNumber(pendingSats),
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
              )}
              {addressQuery.isLoading && (
                <SSText color="muted" size="sm">
                  {t('common.loading')}
                </SSText>
              )}
              {addressQuery.error && !addressQuery.isLoading && (
                <SSText
                  size="sm"
                  style={{ color: Colors.warning }}
                  onPress={handleRetryAddress}
                >
                  {t('ark.board.error.loadAddress')}
                </SSText>
              )}
              {depositAddress && (
                <SSShareableQR
                  qrRef={qrRef}
                  value={depositAddress}
                  size={DEPOSIT_QR_SIZE}
                  containerStyle={styles.qrContainer}
                  hideShareButton
                >
                  <View style={styles.addressBox}>
                    <SSText size="sm" style={styles.monospace}>
                      {depositAddress}
                    </SSText>
                  </View>
                  <SSHStack gap="sm" style={styles.copyShareRow}>
                    <SSButton
                      label={t('common.copy')}
                      onPress={handleCopyAddress}
                      style={styles.copyShareButton}
                      variant="outline"
                    />
                    <SSShareButton
                      qrRef={qrRef}
                      style={styles.copyShareButton}
                    />
                  </SSHStack>
                </SSShareableQR>
              )}
            </SSVStack>
          ) : null}

          {activeTab === 'payjoin' ? (
            <SSVStack gap="sm">
              <SSText color="muted" size="xs">
                {t('ark.board.payjoinDescription')}
              </SSText>
              {boardPayjoin.expired ? (
                <SSVStack gap="sm" itemsCenter style={styles.qrContainer}>
                  <SSText size="sm" center>
                    {t('ark.board.payjoinExpired')}
                  </SSText>
                  {pendingBoards.length > 0 ? (
                    <SSText color="muted" size="xs" center>
                      {t('ark.board.payjoinExpiredPendingHint')}
                    </SSText>
                  ) : null}
                  {showResumeBroadcast ? null : (
                    <SSButton
                      label={t('ark.board.payjoinNewQr')}
                      onPress={handleRestartPayjoin}
                      variant="outline"
                    />
                  )}
                </SSVStack>
              ) : boardPayjoin.error ? (
                <SSVStack gap="sm" itemsCenter style={styles.qrContainer}>
                  <SSText size="sm" center style={{ color: Colors.warning }}>
                    {t('ark.board.payjoinError')}
                  </SSText>
                  <SSText color="muted" size="xs" center>
                    {boardPayjoin.error}
                  </SSText>
                  <SSButton
                    label={t('ark.board.payjoinNewQr')}
                    onPress={handleRestartPayjoin}
                    variant="outline"
                  />
                </SSVStack>
              ) : boardPayjoin.completed ? (
                <SSVStack gap="sm" itemsCenter style={styles.qrContainer}>
                  <SSText size="sm" center>
                    {t('ark.board.payjoinWaitingBroadcast')}
                  </SSText>
                  {boardPayjoin.txid ? (
                    <SSText color="muted" size="xs" style={styles.monospace}>
                      {formatTxId(boardPayjoin.txid, 'wide')}
                    </SSText>
                  ) : null}
                </SSVStack>
              ) : (
                <SSVStack gap="sm">
                  {boardPayjoin.payjoinUri && (
                    <SSShareableQR
                      containerStyle={styles.qrContainer}
                      ecl="L"
                      hideShareButton
                      size={DEPOSIT_QR_SIZE}
                      value={boardPayjoin.payjoinUri}
                    >
                      <SSHStack gap="sm" style={styles.copyShareRow}>
                        <SSButton
                          label={t('common.copy')}
                          onPress={handleCopyPayjoinUri}
                          style={styles.copyShareButton}
                          variant="outline"
                        />
                        <SSShareButton
                          content={boardPayjoin.payjoinUri}
                          style={styles.copyShareButton}
                        />
                      </SSHStack>
                    </SSShareableQR>
                  )}
                  {boardPayjoin.statusLabelKey && (
                    <SSHStack gap="sm" style={styles.statusRow}>
                      {boardPayjoin.busy && (
                        <SSLoader size={PAYJOIN_LOADER_SIZE} />
                      )}
                      <SSText color="muted" size="sm" center>
                        {t(boardPayjoin.statusLabelKey)}
                      </SSText>
                    </SSHStack>
                  )}
                </SSVStack>
              )}
            </SSVStack>
          ) : null}

          {pendingBoards.length > 0 && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.board.pendingTitle')}
              </SSText>
              {showResumeBroadcast && linkedAccount ? (
                <SSText color="muted" size="xs">
                  {t('ark.board.pendingWaitingBroadcast', {
                    name: linkedAccount.name
                  })}
                </SSText>
              ) : requiredConfirmations !== undefined ? (
                <SSText color="muted" size="xs">
                  {t('ark.board.pendingConfirmations', {
                    count: requiredConfirmations
                  })}
                </SSText>
              ) : null}
              {pendingBoards.map((pendingBoard) => (
                <SSHStack
                  key={pendingBoard.vtxoId}
                  justifyBetween
                  style={styles.pendingRow}
                >
                  <SSText size="sm">
                    {formatNumber(pendingBoard.amountSats)} {t('bitcoin.sats')}
                  </SSText>
                  <SSText color="muted" size="xs" style={styles.monospace}>
                    {formatTxId(pendingBoard.txid, 'wide')}
                  </SSText>
                </SSHStack>
              ))}
              {showResumeBroadcast && linkedAccount ? (
                <SSButton
                  label={t('ark.board.broadcastFromLinked', {
                    name: linkedAccount.name
                  })}
                  onPress={resumeLinkedBroadcast}
                  variant="secondary"
                />
              ) : null}
            </SSVStack>
          )}

          <SSHStack gap="sm" style={styles.confirmRow}>
            <SSButton
              label={t('common.cancel')}
              onPress={handleCancel}
              variant="ghost"
              style={styles.actionButton}
              disabled={busy}
            />
            {activeTab === 'wallet' && selectedSource ? (
              <SSButton
                label={
                  fromAccount
                    ? t('ark.board.fromWallet.action')
                    : t('ark.board.action')
                }
                onPress={handleSubmit}
                loading={busy}
                disabled={!canSubmit}
                variant="secondary"
                style={styles.actionButton}
              />
            ) : null}
          </SSHStack>
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    flex: 1
  },
  addressBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  confirmRow: {
    marginTop: 8
  },
  container: {
    paddingBottom: 60,
    paddingTop: 20
  },
  copyShareButton: {
    flex: 1
  },
  copyShareRow: {
    width: '100%'
  },
  monospace: {
    fontFamily: Typography.geistMonoRegular
  },
  pendingRow: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 12
  },
  statusRow: {
    alignItems: 'center',
    justifyContent: 'center'
  }
})
