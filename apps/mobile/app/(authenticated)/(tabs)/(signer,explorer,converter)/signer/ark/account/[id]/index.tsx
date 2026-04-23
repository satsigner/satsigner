import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Platform, ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSettings, SSIconTrash } from '@/components/icons'
import SSIconWarning from '@/components/icons/SSIconWarning'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkDeleteAccount } from '@/hooks/useArkDeleteAccount'
import { useArkWallet } from '@/hooks/useArkWallet'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

const PRIVACY_MASK = '••••'
const HEADER_ICON_STROKE = '#828282'

export default function ArkAccountDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [accounts, cachedBalance] = useArkStore(
    useShallow((state) => [state.accounts, state.balances[id]])
  )
  const account = accounts.find((a) => a.id === id)

  const walletQuery = useArkWallet(id)
  const balanceQuery = useArkBalance(id)
  const { deleteAccount } = useArkDeleteAccount()
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const balance = balanceQuery.data ?? cachedBalance
  const spendable = balance?.spendableSats ?? 0
  const totalSize = spendable > 1_000_000_000 ? '4xl' : '6xl'
  const isLoading =
    (walletQuery.isLoading || balanceQuery.isLoading) && !balance
  const loadError = walletQuery.error ?? balanceQuery.error

  function handleComingSoon() {
    toast.info(t('ark.comingSoon'))
  }

  function handleReceive() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/receive'
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

  function renderHeaderRight() {
    return (
      <SSHStack gap="none" style={styles.headerRight}>
        <SSIconButton onPress={() => setDeleteModalVisible(true)}>
          <SSIconTrash
            height={HEADER_CHROME_SETTINGS_ICON_SIZE}
            stroke={HEADER_ICON_STROKE}
            strokeWidth={1}
            width={HEADER_CHROME_SETTINGS_ICON_SIZE}
          />
        </SSIconButton>
        <SSIconButton
          style={
            Platform.OS === 'android' && [
              HEADER_CHROME_HIT_BOX,
              { marginRight: -HEADER_CHROME_EDGE_NUDGE }
            ]
          }
          onPress={() => router.navigate('/settings')}
        >
          <SSIconSettings
            height={HEADER_CHROME_SETTINGS_ICON_SIZE}
            stroke={HEADER_ICON_STROKE}
            width={HEADER_CHROME_SETTINGS_ICON_SIZE}
          />
        </SSIconButton>
      </SSHStack>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: renderHeaderRight,
          headerTitle: () => (
            <SSText uppercase>
              {account?.name ?? t('navigation.item.ark')}
            </SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack itemsCenter gap="none">
          <SSVStack style={styles.balanceContainer} gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ark.balance.title')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              {privacyMode ? (
                <SSText
                  color="white"
                  size={totalSize}
                  weight="ultralight"
                  style={{
                    letterSpacing: -1,
                    lineHeight: Sizes.text.fontSize[totalSize]
                  }}
                >
                  {PRIVACY_MASK}
                </SSText>
              ) : (
                <SSStyledSatText
                  amount={spendable}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  textSize={totalSize}
                  weight="ultralight"
                  letterSpacing={-1}
                />
              )}
              <SSText size="xl" color="muted">
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
            </SSHStack>
            {btcPrice > 0 && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {privacyMode
                    ? PRIVACY_MASK
                    : formatFiatPrice(spendable, btcPrice)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
            {isLoading && (
              <SSText color="muted" size="xs">
                {t('common.loading')}
              </SSText>
            )}
            {!!loadError && !isLoading && (
              <SSText style={{ color: Colors.warning }} size="xs" center>
                {t('ark.error.walletLoad')}
              </SSText>
            )}
          </SSVStack>
          <SSHStack gap="none" style={styles.actionRow}>
            <SSActionButton
              style={styles.actionButton}
              onPress={handleComingSoon}
            >
              <SSText uppercase>{t('account.send')}</SSText>
            </SSActionButton>
            <SSActionButton style={styles.actionButton} onPress={handleReceive}>
              <SSText uppercase>{t('account.receive')}</SSText>
            </SSActionButton>
          </SSHStack>
        </SSVStack>
      </ScrollView>
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
  actionButton: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderWidth: 1,
    flex: 1,
    height: 56
  },
  actionRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%'
  },
  balanceContainer: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 24
  },
  headerRight: {
    alignItems: 'center'
  },
  modalContent: {
    paddingVertical: 8,
    width: '100%'
  }
})
