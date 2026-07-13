import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconArrowsClockwise,
  SSIconBoardCircle,
  SSIconOffboardCircle,
  SSIconSignOut
} from '@/components/icons'
import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSSettingsCards from '@/components/SSSettingsCard'
import SSText from '@/components/SSText'
import { useArkDeleteAccount } from '@/hooks/useArkDeleteAccount'
import { useArkExit } from '@/hooks/useArkExit'
import { useArkExitFeeEstimate } from '@/hooks/useArkExitFeeEstimate'
import { useArkExportDatadir } from '@/hooks/useArkExportDatadir'
import { useArkRefresh } from '@/hooks/useArkRefresh'
import { useArkRefreshFeeEstimate } from '@/hooks/useArkRefreshFeeEstimate'
import { useArkSpendableVtxos } from '@/hooks/useArkSpendableVtxos'
import { useArkVtxos } from '@/hooks/useArkVtxos'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { Colors, Layout } from '@/styles'
import { formatNumber } from '@/utils/format'

const SETTINGS_ICON_SIZE = 24

export default function ArkAccountSettingsPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === id))
  )
  const { deleteAccount } = useArkDeleteAccount()
  const { exportDb, isExporting } = useArkExportDatadir()

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [refreshModalVisible, setRefreshModalVisible] = useState(false)
  const [exitModalVisible, setExitModalVisible] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const spendableVtxosQuery = useArkSpendableVtxos(id)
  const vtxosQuery = useArkVtxos(id)
  const refreshMutation = useArkRefresh(id)
  const exitMutation = useArkExit(id)

  const spendableVtxos = spendableVtxosQuery.data ?? []
  const allVtxos = vtxosQuery.data ?? []
  const spendableVtxoIds = spendableVtxos.map((vtxo) => vtxo.id)

  const refreshFeeQuery = useArkRefreshFeeEstimate({
    accountId: id,
    enabled: refreshModalVisible,
    vtxoIds: spendableVtxoIds
  })
  const exitFeeQuery = useArkExitFeeEstimate({
    accountId: id,
    enabled: exitModalVisible,
    vtxos: allVtxos
  })

  async function handleExportDb() {
    if (!account) {
      return
    }
    try {
      await exportDb(account)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('ark.error.exportDb')
      toast.error(message)
    }
  }

  function handleRefreshAll() {
    if (spendableVtxoIds.length === 0) {
      toast.error(t('ark.vtxo.emptySpendable'))
      return
    }
    setRefreshModalVisible(true)
  }

  function handleConfirmRefreshAll() {
    if (spendableVtxoIds.length === 0) {
      toast.error(t('ark.vtxo.emptySpendable'))
      setRefreshModalVisible(false)
      return
    }
    refreshMutation.mutate(spendableVtxoIds, {
      onError: (error) => {
        toast.error(error.message || t('ark.refresh.error'))
      },
      onSuccess: () => {
        toast.success(t('ark.refresh.success'))
        setRefreshModalVisible(false)
      }
    })
  }

  function handleBoard() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/settings/board'
    })
  }

  function handleOffboardAll() {
    if (spendableVtxoIds.length === 0) {
      toast.error(t('ark.vtxo.emptySpendable'))
      return
    }
    router.navigate({
      params: { id, selectAll: 'true' },
      pathname: '/signer/ark/account/[id]/settings/offboard'
    })
  }

  function handleEmergencyExitAll() {
    if (allVtxos.length === 0) {
      toast.error(t('ark.vtxo.empty'))
      return
    }
    setExitModalVisible(true)
  }

  function handleConfirmEmergencyExitAll() {
    exitMutation.mutate(undefined, {
      onError: (error) => {
        toast.error(error.message || t('ark.exit.error'))
      },
      onSuccess: () => {
        toast.success(t('ark.exit.success'))
        setExitModalVisible(false)
      }
    })
  }

  async function handleConfirmDelete() {
    if (!id) {
      return
    }
    setIsDeleting(true)
    try {
      await deleteAccount(id)
      setDeleteModalVisible(false)
      toast.success(t('ark.account.deleteSuccess'))
      router.replace('/signer/ark')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('ark.error.delete')
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {account?.name ?? t('navigation.item.ark')}
            </SSText>
          )
        }}
      />
      <SSVStack gap="none">
        <SSSettingsCards
          title={t('ark.refresh.allTitle')}
          description={t('ark.refresh.allDescription')}
          icon={
            <SSIconArrowsClockwise
              height={SETTINGS_ICON_SIZE}
              width={SETTINGS_ICON_SIZE}
            />
          }
          onPress={handleRefreshAll}
        />
        <SSSettingsCards
          title={t('ark.board.allTitle')}
          description={t('ark.board.allDescription')}
          icon={
            <SSIconBoardCircle
              height={SETTINGS_ICON_SIZE}
              width={SETTINGS_ICON_SIZE}
            />
          }
          onPress={handleBoard}
        />
        <SSSettingsCards
          title={t('ark.offboard.allTitle')}
          description={t('ark.offboard.allDescription')}
          icon={
            <SSIconOffboardCircle
              height={SETTINGS_ICON_SIZE}
              width={SETTINGS_ICON_SIZE}
            />
          }
          onPress={handleOffboardAll}
        />
        <SSSettingsCards
          title={t('ark.exit.allTitle')}
          description={t('ark.exit.allDescription')}
          icon={
            <SSIconSignOut
              height={SETTINGS_ICON_SIZE}
              width={SETTINGS_ICON_SIZE}
              stroke={Colors.error}
            />
          }
          onPress={handleEmergencyExitAll}
        />
      </SSVStack>
      <SSVStack gap="lg" style={styles.actions}>
        <SSButton
          label={t('ark.account.exportDb')}
          onPress={handleExportDb}
          loading={isExporting}
          disabled={isExporting}
        />
        <SSButton
          label={t('ark.account.deleteWalletAction')}
          onPress={() => setDeleteModalVisible(true)}
          variant="danger"
        />
      </SSVStack>
      <SSModal
        visible={refreshModalVisible}
        onClose={() => setRefreshModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContent}>
          <SSVStack gap="sm" itemsCenter>
            <SSText center uppercase size="md" weight="medium">
              {t('ark.refresh.confirmTitle')}
            </SSText>
            <SSText center color="muted">
              {t('ark.refresh.confirmDescription', {
                count: spendableVtxoIds.length
              })}
            </SSText>
            {refreshFeeQuery.isLoading && (
              <SSText color="muted" size="sm">
                {t('common.loading')}
              </SSText>
            )}
            {refreshFeeQuery.data ? (
              <SSText color="muted" size="sm">
                {t('ark.refresh.feeLabel', {
                  amount: formatNumber(refreshFeeQuery.data.feeSats),
                  unit: t('bitcoin.sats')
                })}
              </SSText>
            ) : null}
            {refreshFeeQuery.error ? (
              <SSText
                size="sm"
                style={{ color: Colors.warning }}
                onPress={() => refreshFeeQuery.refetch()}
              >
                {t('ark.refresh.feeUnavailable')}
              </SSText>
            ) : null}
          </SSVStack>
          <SSButton
            label={t('ark.refresh.action')}
            variant="secondary"
            loading={refreshMutation.isPending}
            disabled={refreshMutation.isPending || refreshFeeQuery.isLoading}
            onPress={handleConfirmRefreshAll}
          />
        </SSVStack>
      </SSModal>
      <SSModal
        visible={exitModalVisible}
        onClose={() => setExitModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContent}>
          <SSVStack gap="sm" itemsCenter>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.error}
            />
            <SSText center uppercase size="md" weight="medium">
              {t('ark.exit.allConfirmTitle')}
            </SSText>
            <SSText center color="muted">
              {t('ark.exit.confirmDescription')}
            </SSText>
            {exitFeeQuery.isLoading && (
              <SSText color="muted" size="sm">
                {t('common.loading')}
              </SSText>
            )}
            {exitFeeQuery.data ? (
              <SSVStack gap="xxs" itemsCenter>
                <SSText color="muted" size="sm">
                  {t('ark.exit.feeLabel', {
                    amount: formatNumber(exitFeeQuery.data.feeSats),
                    feeRate: exitFeeQuery.data.feeRateSatPerVb,
                    unit: t('bitcoin.sats')
                  })}
                </SSText>
                <SSText color="muted" size="xs" center>
                  {t('ark.exit.feeHint')}
                </SSText>
              </SSVStack>
            ) : null}
            {exitFeeQuery.error ? (
              <SSText
                size="sm"
                style={{ color: Colors.warning }}
                onPress={() => exitFeeQuery.refetch()}
              >
                {t('ark.exit.feeUnavailable')}
              </SSText>
            ) : null}
          </SSVStack>
          <SSButton
            label={t('ark.exit.confirm')}
            variant="danger"
            loading={exitMutation.isPending}
            disabled={exitMutation.isPending || exitFeeQuery.isLoading}
            onPress={handleConfirmEmergencyExitAll}
          />
        </SSVStack>
      </SSModal>
      <SSModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        label={t('common.cancel')}
        closeButtonVariant="ghost"
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContent}>
          <SSVStack gap="sm" itemsCenter>
            <SSIconWarning
              height={20}
              width={20}
              fill="transparent"
              stroke={Colors.gray[400]}
            />
            <SSText center uppercase size="md" weight="medium">
              {t('ark.account.deleteWallet')}
            </SSText>
            <SSText center color="muted">
              {t('ark.account.deleteWalletWarning')}
            </SSText>
          </SSVStack>
          <SSButton
            label={t('common.delete')}
            onPress={handleConfirmDelete}
            variant="danger"
            loading={isDeleting}
            disabled={isDeleting}
          />
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actions: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: 24
  },
  container: {
    paddingHorizontal: 0
  },
  modalContent: {
    paddingVertical: 8,
    width: '100%'
  }
})
