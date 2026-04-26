import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import { useArkDeleteAccount } from '@/hooks/useArkDeleteAccount'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { Colors } from '@/styles'

export default function ArkAccountSettingsPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const account = useArkStore(
    useShallow((state) => state.accounts.find((a) => a.id === id))
  )
  const { deleteAccount } = useArkDeleteAccount()

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {account?.name ?? t('navigation.item.ark')}
            </SSText>
          )
        }}
      />
      <SSVStack gap="lg" style={styles.container}>
        <SSButton
          label={t('ark.offboard.title')}
          onPress={() =>
            router.navigate({
              params: { id },
              pathname: '/signer/ark/account/[id]/settings/offboard'
            })
          }
          variant="secondary"
        />
        <SSButton
          label={t('common.delete')}
          onPress={() => setDeleteModalVisible(true)}
          variant="danger"
        />
      </SSVStack>
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
  container: {
    paddingTop: 24
  },
  modalContent: {
    paddingVertical: 8,
    width: '100%'
  }
})
