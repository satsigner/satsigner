import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSQRCode from '@/components/SSQRCode'
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
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { Colors } from '@/styles'
import type { ArkBoardValidationReason } from '@/utils/arkBoard'
import { validateBoardAmount } from '@/utils/arkBoard'
import { setClipboard } from '@/utils/clipboard'
import { formatAddress, formatNumber } from '@/utils/format'

const DEPOSIT_QR_SIZE = 200
const TXID_TRUNCATE_CHARS = 8

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
  const { fundFromLinkedAccount, linkedAccount } = useArkBoardDeposit(account)

  const [amountSats, setAmountSats] = useState(0)

  const confirmedSats = balanceQuery.data?.confirmedSats ?? 0
  const pendingSats = balanceQuery.data?.pendingSats ?? 0
  const minBoardAmountSats = serverInfoQuery.data?.minBoardAmountSats
  const requiredConfirmations = serverInfoQuery.data?.requiredBoardConfirmations
  const pendingBoards = pendingBoardsQuery.data ?? []
  const depositAddress = addressQuery.data

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
    enabled: validation.valid
  })
  const feeSats = feeQuery.data?.feeSats
  const canBoard =
    validation.valid && !boardMutation.isPending && feeSats !== undefined

  async function handleCopyAddress() {
    if (!depositAddress) {
      return
    }
    await setClipboard(depositAddress)
    toast.success(t('common.copiedToClipboard'))
  }

  function handleFundFromLinkedAccount() {
    if (!depositAddress) {
      return
    }
    fundFromLinkedAccount(depositAddress)
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
          router.replace({
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
            {t('ark.board.description')}
          </SSText>

          <SSVStack gap="xs">
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
            {balanceQuery.data && (
              <SSVStack gap="none">
                <SSHStack gap="xs" style={styles.balanceRow}>
                  <SSText size="2xl">{formatNumber(confirmedSats)}</SSText>
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
            )}
          </SSVStack>

          <SSVStack gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.board.depositTitle')}
            </SSText>
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
                <View style={styles.qrContainer}>
                  <SSQRCode value={depositAddress} size={DEPOSIT_QR_SIZE} />
                </View>
                <View style={styles.addressBox}>
                  <SSText size="sm" style={styles.monospace}>
                    {depositAddress}
                  </SSText>
                </View>
                <SSButton
                  label={t('common.copy')}
                  onPress={handleCopyAddress}
                  variant="outline"
                />
                {linkedAccount && (
                  <SSButton
                    label={t('ark.board.fundFromLinked', {
                      name: linkedAccount.name
                    })}
                    onPress={handleFundFromLinkedAccount}
                    variant="subtle"
                  />
                )}
              </SSVStack>
            )}
          </SSVStack>

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
                {t('ark.board.error.insufficientFunds')}
              </SSText>
            )}
          </SSVStack>

          {pendingBoards.length > 0 && (
            <SSVStack gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ark.board.pendingTitle')}
              </SSText>
              {requiredConfirmations !== undefined && (
                <SSText color="muted" size="xs">
                  {t('ark.board.pendingConfirmations', {
                    count: requiredConfirmations
                  })}
                </SSText>
              )}
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
                    {formatAddress(pendingBoard.txid, TXID_TRUNCATE_CHARS)}
                  </SSText>
                </SSHStack>
              ))}
            </SSVStack>
          )}

          <SSHStack gap="sm" style={styles.confirmRow}>
            <SSButton
              label={t('common.cancel')}
              onPress={() => router.back()}
              variant="ghost"
              style={styles.actionButton}
              disabled={boardMutation.isPending}
            />
            <SSButton
              label={t('ark.board.action')}
              onPress={handleBoard}
              loading={boardMutation.isPending}
              disabled={!canBoard}
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
  }
})
