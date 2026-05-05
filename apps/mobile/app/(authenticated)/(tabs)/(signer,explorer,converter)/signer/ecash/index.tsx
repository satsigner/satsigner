import { FlashList } from '@shopify/flash-list'
import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { SSIconECash } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useEcashStore } from '@/store/ecash'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import type { EcashAccount } from '@/types/models/Ecash'
import { formatFiatPrice } from '@/utils/format'

const ECASH_CARD_FILL_TOP = Colors.gray[905]
const ECASH_CARD_FILL_BOTTOM = Colors.gray[925]
const ECASH_CARD_SHEEN_COLORS = [
  'rgba(255, 255, 255, 0.04)',
  'rgba(255, 255, 255, 0)',
  'rgba(255, 255, 255, 0.012)'
] as const

/** Darker than `muted` for sats / BTC / fiat balance labels */
const ECASH_BALANCE_LABEL_COLOR = Colors.gray[500]

function EcashAccountCard({
  account,
  balance,
  mintCount,
  mintName,
  onPress
}: {
  account: EcashAccount
  balance: number
  mintCount: number
  mintName?: string
  onPress: () => void
}) {
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  const mintLabel =
    mintCount === 1 && mintName
      ? `1 ${t('ecash.mint.singular')} · ${mintName}`
      : `${mintCount} ${mintCount === 1 ? t('ecash.mint.singular') : t('ecash.mint.plural')}`

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <View style={styles.accountCardShell}>
        <LinearGradient
          colors={[ECASH_CARD_FILL_TOP, ECASH_CARD_FILL_BOTTOM]}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          start={{ x: 0.5, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.accountCardFill]}
        />
        <LinearGradient
          colors={[...ECASH_CARD_SHEEN_COLORS]}
          end={{ x: 0.82, y: 0.95 }}
          locations={[0, 0.52, 1]}
          pointerEvents="none"
          start={{ x: 0.1, y: 0 }}
          style={[StyleSheet.absoluteFillObject, styles.accountCardSheen]}
        />
        <View pointerEvents="none" style={styles.accountCardInnerStroke} />
        <View style={styles.accountCardContent}>
          <View style={styles.accountCardHeader}>
            <View style={styles.accountCardHeaderLeft}>
              <SSText weight="medium" size="md">
                {account.name}
              </SSText>
              {!account.hasSeed && (
                <View style={styles.legacyBadge}>
                  <SSText size="xxs" style={{ color: Colors.warning }}>
                    {t('ecash.account.noSeed')}
                  </SSText>
                </View>
              )}
            </View>
            <SSText color="muted" size="xs">
              {mintLabel}
            </SSText>
          </View>
          <View style={styles.accountCardBody}>
            <View style={styles.amountRow}>
              {privacyMode ? (
                <SSText
                  size="lg"
                  weight="ultralight"
                  style={{ lineHeight: Sizes.text.fontSize.lg }}
                >
                  {NOSTR_PRIVACY_MASK}
                </SSText>
              ) : (
                <SSStyledSatText
                  amount={balance}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  textSize="lg"
                  weight="ultralight"
                  letterSpacing={-1}
                />
              )}
              <SSText
                size="xs"
                style={{
                  color: ECASH_BALANCE_LABEL_COLOR,
                  opacity: privacyMode ? 0 : 1
                }}
              >
                {currencyUnit === 'btc' ? 'BTC' : 'sats'}
              </SSText>
            </View>
            {btcPrice > 0 && (
              <SSText
                size="xs"
                style={{
                  color: ECASH_BALANCE_LABEL_COLOR,
                  opacity: privacyMode ? 0 : 1
                }}
              >
                {formatFiatPrice(balance, btcPrice)}{' '}
                <SSText size="xs" style={{ color: ECASH_BALANCE_LABEL_COLOR }}>
                  {fiatCurrency}
                </SSText>
              </SSText>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function EcashAccountListPage() {
  const router = useRouter()
  const [accounts, allMints, allProofs, setActiveAccountId] = useEcashStore(
    useShallow((state) => [
      state.accounts,
      state.mints,
      state.proofs,
      state.setActiveAccountId
    ])
  )

  function getAccountBalance(accountId: string): number {
    const accountProofs = allProofs[accountId] ?? []
    return accountProofs.reduce((sum, proof) => sum + proof.amount, 0)
  }

  function getAccountMintCount(accountId: string): number {
    return (allMints[accountId] ?? []).length
  }

  function getFirstMintName(accountId: string): string | undefined {
    return (allMints[accountId] ?? [])[0]?.name
  }

  function handleAccountPress(account: EcashAccount) {
    setActiveAccountId(account.id)
    router.navigate(`/signer/ecash/account/${account.id}`)
  }

  function handleAddAccount() {
    router.navigate('/signer/ecash/account/add')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('navigation.item.ecash')}</SSText>
          )
        }}
      />
      {accounts.length === 0 ? (
        <SSVStack itemsCenter gap="lg" style={styles.emptyState}>
          <SSIconECash height={48} width={48} />
          <SSVStack itemsCenter gap="sm">
            <SSText size="lg" weight="medium">
              {t('ecash.account.noAccounts')}
            </SSText>
            <SSText color="muted" center>
              {t('ecash.account.noAccountsDescription')}
            </SSText>
          </SSVStack>
          <SSButton
            label={t('ecash.account.addAccount')}
            onPress={handleAddAccount}
            variant="gradient"
            gradientType="special"
            style={styles.addButton}
          />
        </SSVStack>
      ) : (
        <SSVStack gap="md" style={styles.listContainer}>
          <FlashList
            data={accounts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <EcashAccountCard
                account={item}
                balance={getAccountBalance(item.id)}
                mintCount={getAccountMintCount(item.id)}
                mintName={getFirstMintName(item.id)}
                onPress={() => handleAccountPress(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <SSButton
            label={t('ecash.account.addAccount')}
            onPress={handleAddAccount}
            variant="outline"
          />
        </SSVStack>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  accountCardBody: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  accountCardContent: {
    padding: 16,
    position: 'relative',
    zIndex: 2
  },
  accountCardFill: {
    borderRadius: Sizes.button.borderRadius
  },
  accountCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  accountCardHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  accountCardInnerStroke: {
    borderColor: 'rgba(255, 255, 255, 0.045)',
    borderRadius: Sizes.button.borderRadius - 1,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: StyleSheet.hairlineWidth,
    left: StyleSheet.hairlineWidth,
    pointerEvents: 'none',
    position: 'absolute',
    right: StyleSheet.hairlineWidth,
    top: StyleSheet.hairlineWidth,
    zIndex: 1
  },
  accountCardSheen: {
    borderRadius: Sizes.button.borderRadius
  },
  accountCardShell: {
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: Sizes.button.borderRadius,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  addButton: {
    maxWidth: 280,
    width: '100%'
  },
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  legacyBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  listContainer: {
    flex: 1,
    paddingBottom: 20
  },
  separator: {
    height: 8
  }
})
