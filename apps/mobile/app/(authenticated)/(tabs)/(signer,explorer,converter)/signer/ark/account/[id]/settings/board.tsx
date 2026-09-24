import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSLoader from '@/components/SSLoader'
import SSPairedTabs from '@/components/SSPairedTabs'
import SSShareableQR from '@/components/SSShareableQR'
import SSShareButton from '@/components/SSShareButton'
import SSText from '@/components/SSText'
import { DUST_LIMIT } from '@/constants/btc'
import {
  useArkBoardFeeEstimate,
  useArkBoardMutation,
  useArkOnchainAddress,
  useArkOnchainBalance,
  useArkPendingBoards,
  useArkServerInfo
} from '@/hooks/useArkBoard'
import { useArkBoardDeposit } from '@/hooks/useArkBoardDeposit'
import { useArkBoardPayjoin } from '@/hooks/useArkBoardPayjoin'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { getAccountTotalBalance } from '@/utils/account'
import {
  type ArkBoardValidationReason,
  validateBoardAmount
} from '@/utils/arkBoard'
import {
  matchingUnbroadcastBoardTxid,
  txidFromSignedDraft
} from '@/utils/arkBoardDeposit'
import { setClipboard } from '@/utils/clipboard'
import { formatNumber, formatTxId } from '@/utils/format'

const DEPOSIT_QR_SIZE = 200
const PAYJOIN_LOADER_SIZE = 18

type FundTab = 'address' | 'payjoin'

const VALIDATION_ERROR_KEYS: Record<ArkBoardValidationReason, string> = {
  belowMinimum: 'ark.board.error.belowMinimum',
  insufficientFunds: 'ark.board.error.insufficientFunds',
  invalidAmount: 'ark.board.error.invalidAmount'
}

export default function ArkBoardPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === id))
  )

  const balanceQuery = useArkOnchainBalance(id)
  const addressQuery = useArkOnchainAddress(id)
  const pendingBoardsQuery = useArkPendingBoards(id)
  const serverInfoQuery = useArkServerInfo(id)
  const boardMutation = useArkBoardMutation(id)
  const { fundFromLinkedAccount, linkedAccount, resumeLinkedBroadcast } =
    useArkBoardDeposit(account)
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
  const [fundTab, setFundTab] = useState<FundTab>('address')
  const qrRef = useRef<View>(null)

  const confirmedSats = balanceQuery.data?.confirmedSats ?? 0
  const pendingSats = balanceQuery.data?.pendingSats ?? 0
  const minBoardAmountSats = serverInfoQuery.data?.minBoardAmountSats
  const requiredConfirmations = serverInfoQuery.data?.requiredBoardConfirmations
  const pendingBoards = pendingBoardsQuery.data ?? []
  const depositAddress = addressQuery.data
  const showPayjoin = boardPayjoin.available && fundTab === 'payjoin'
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
  const fundDestination = showPayjoin ? boardPayjoin.payjoinUri : depositAddress
  const showFundFromLinked =
    !!linkedAccount &&
    !!fundDestination &&
    !showResumeBroadcast &&
    (!showPayjoin ||
      (!boardPayjoin.completed && !boardPayjoin.error && !boardPayjoin.expired))

  const minAmountSats = Math.max(DUST_LIMIT, minBoardAmountSats ?? 0)
  const canEnterAmount = confirmedSats >= minAmountSats
  const validation = validateBoardAmount({
    amountSats,
    availableSats: confirmedSats,
    minBoardAmountSats
  })
  const boardAll = validation.valid && amountSats >= confirmedSats

  const feeQuery = useArkBoardFeeEstimate({
    accountId: id,
    amountSats,
    enabled: validation.valid && !showPayjoin
  })
  const feeSats = feeQuery.data?.feeSats
  const canBoard =
    validation.valid && !boardMutation.isPending && feeSats !== undefined

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

  function handleFundFromLinkedAccount() {
    if (!fundDestination) {
      return
    }
    fundFromLinkedAccount(fundDestination, minAmountSats)
  }

  function handleCancel() {
    router.back()
  }

  function handleBoard() {
    if (!validation.valid) {
      toast.error(t(VALIDATION_ERROR_KEYS[validation.reason]))
      return
    }
    boardMutation.mutate(
      { amountSats: boardAll ? undefined : amountSats },
      {
        onError: (error) => {
          const reason = error instanceof Error ? error.message : 'unknown'
          toast.error(`${t('ark.board.error.generic')}: ${reason}`)
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

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('ark.board.title')}</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg" style={styles.container}>
          <SSText color="muted" size="xs">
            {showPayjoin
              ? t('ark.board.payjoinDescription')
              : t('ark.board.description')}
          </SSText>

          {showPayjoin ? (
            linkedAccount ? (
              <SSVStack gap="xxs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.board.linkedWallet', { name: linkedAccount.name })}
                </SSText>
                <SSHStack gap="xs" style={styles.balanceRow}>
                  <SSText size="2xl">
                    {formatNumber(
                      getAccountTotalBalance(linkedAccount.summary)
                    )}
                  </SSText>
                  <SSText color="muted" size="sm">
                    {t('bitcoin.sats')}
                  </SSText>
                </SSHStack>
              </SSVStack>
            ) : null
          ) : (
            <SSVStack gap="xs">
              <SSHStack gap="md" style={styles.walletRow}>
                <SSVStack gap="xxs" style={styles.walletColumn}>
                  <SSText color="muted" size="xs" uppercase>
                    {t('ark.board.onchainBalance')}
                  </SSText>
                  {balanceQuery.isLoading && (
                    <SSText color="muted" size="sm">
                      {t('common.loading')}
                    </SSText>
                  )}
                  {balanceQuery.error && !balanceQuery.isLoading && (
                    <SSText
                      size="sm"
                      style={{ color: Colors.warning }}
                      onPress={() => balanceQuery.refetch()}
                    >
                      {t('ark.board.error.loadBalance')}
                    </SSText>
                  )}
                  {balanceQuery.data ? (
                    <SSVStack gap="none">
                      <SSHStack gap="xs" style={styles.balanceRow}>
                        <SSText size="2xl">
                          {formatNumber(confirmedSats)}
                        </SSText>
                        <SSText color="muted" size="sm">
                          {t('bitcoin.sats')}
                        </SSText>
                      </SSHStack>
                      {pendingSats > 0 && (
                        <SSText color="muted" size="xs">
                          {t('ark.board.balancePendingHint', {
                            amount: formatNumber(pendingSats),
                            unit: t('bitcoin.sats')
                          })}
                        </SSText>
                      )}
                    </SSVStack>
                  ) : null}
                </SSVStack>
                {linkedAccount ? (
                  <SSVStack gap="xxs" style={styles.walletColumn}>
                    <SSText color="muted" size="xs" uppercase>
                      {t('ark.board.linkedWallet', {
                        name: linkedAccount.name
                      })}
                    </SSText>
                    <SSHStack gap="xs" style={styles.balanceRow}>
                      <SSText size="2xl">
                        {formatNumber(
                          getAccountTotalBalance(linkedAccount.summary)
                        )}
                      </SSText>
                      <SSText color="muted" size="sm">
                        {t('bitcoin.sats')}
                      </SSText>
                    </SSHStack>
                  </SSVStack>
                ) : null}
              </SSHStack>
              <SSText color="muted" size="xs">
                {t('ark.board.onchainBalanceHint')}
              </SSText>
            </SSVStack>
          )}

          <SSVStack gap="xs">
            {boardPayjoin.available ? (
              <SSPairedTabs<FundTab>
                activeTab={fundTab}
                primary={{ key: 'address', label: t('ark.board.addressTab') }}
                secondary={{
                  key: 'payjoin',
                  label: t('ark.board.payjoinTab')
                }}
                onChange={setFundTab}
              />
            ) : (
              <SSText color="muted" size="xs" uppercase>
                {t('ark.board.depositTitle')}
              </SSText>
            )}
            {showPayjoin ? (
              <SSVStack gap="sm">
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
                    {showResumeBroadcast && linkedAccount ? (
                      <SSButton
                        label={t('ark.board.broadcastFromLinked', {
                          name: linkedAccount.name
                        })}
                        onPress={resumeLinkedBroadcast}
                        variant="secondary"
                      />
                    ) : (
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
                    {showFundFromLinked && linkedAccount ? (
                      <SSButton
                        label={t('ark.board.fundFromLinked', {
                          name: linkedAccount.name
                        })}
                        onPress={handleFundFromLinkedAccount}
                        variant="subtle"
                      />
                    ) : null}
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
            ) : (
              <SSVStack gap="xs">
                <SSText color="muted" size="xs">
                  {t('ark.board.depositDescription')}
                </SSText>
                {addressQuery.isLoading && (
                  <SSText color="muted" size="sm">
                    {t('common.loading')}
                  </SSText>
                )}
                {addressQuery.error && !addressQuery.isLoading && (
                  <SSText
                    size="sm"
                    style={{ color: Colors.warning }}
                    onPress={() => addressQuery.refetch()}
                  >
                    {t('ark.board.error.loadAddress')}
                  </SSText>
                )}
                {depositAddress && (
                  <SSVStack gap="sm">
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
                    {showFundFromLinked && linkedAccount ? (
                      <SSButton
                        label={t('ark.board.fundFromLinked', {
                          name: linkedAccount.name
                        })}
                        onPress={handleFundFromLinkedAccount}
                        variant="subtle"
                      />
                    ) : null}
                  </SSVStack>
                )}
              </SSVStack>
            )}
          </SSVStack>

          {!showPayjoin ? (
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
                    min={minAmountSats}
                    max={confirmedSats}
                    value={amountSats}
                    onValueChange={setAmountSats}
                  />
                  {amountSats > 0 && !validation.valid && (
                    <SSText size="xs" style={{ color: Colors.warning }}>
                      {t(VALIDATION_ERROR_KEYS[validation.reason])}
                    </SSText>
                  )}
                  {validation.valid && (
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
                          onPress={() => feeQuery.refetch()}
                        >
                          {t('ark.board.feeUnavailable')}
                        </SSText>
                      ) : null}
                    </SSHStack>
                  )}
                </SSVStack>
              ) : (
                <SSText color="muted" size="xs">
                  {t('ark.board.amountEmpty')}
                </SSText>
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
              disabled={boardMutation.isPending}
            />
            {showPayjoin ? null : (
              <SSButton
                label={t('ark.board.action')}
                onPress={handleBoard}
                loading={boardMutation.isPending}
                disabled={!canBoard}
                variant="secondary"
                style={styles.actionButton}
              />
            )}
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
  addressBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  balanceRow: {
    alignItems: 'baseline'
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
    fontFamily: 'monospace'
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
  },
  walletColumn: {
    flex: 1
  },
  walletRow: {
    alignItems: 'flex-start'
  }
})
