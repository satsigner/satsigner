import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { Layout } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import { satsToFiat } from '@/utils/fiat'
import { formatAddress, formatDate, formatNumber } from '@/utils/format'
import { normalizeUtxoLabelForDisplay } from '@/utils/parse'
import { getUtxoOutpoint } from '@/utils/utxo'

type SSExcludedUtxoRowProps = Pick<
  DisplayPreferences,
  | 'btcPrice'
  | 'currencyUnit'
  | 'fiatCurrency'
  | 'fiatEnabled'
  | 'useZeroPadding'
> & {
  utxo: Utxo
  accountId: string
}

function SSExcludedUtxoRow({
  utxo,
  accountId,
  btcPrice,
  currencyUnit,
  fiatCurrency,
  fiatEnabled,
  useZeroPadding
}: SSExcludedUtxoRowProps) {
  const includeUtxoOutpoints = useAccountsStore(
    (state) => state.includeUtxoOutpoints
  )
  const label = normalizeUtxoLabelForDisplay(utxo.label || '')
  const outpoint = getUtxoOutpoint(utxo)

  function handleInclude() {
    includeUtxoOutpoints(accountId, [outpoint])
  }

  return (
    <SSVStack gap="sm" style={styles.row}>
      <SSHStack justifyBetween>
        <SSHStack gap="xs" style={styles.amountRow}>
          <SSStyledSatText
            amount={utxo.value}
            decimals={0}
            useZeroPadding={useZeroPadding}
            currency={currencyUnit}
            textSize="md"
          />
          <SSText size="xs" color="muted">
            {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
          </SSText>
        </SSHStack>
        <SSText size="sm" color="muted" type="mono">
          {utxo.addressTo ? formatAddress(utxo.addressTo) : ''}
        </SSText>
      </SSHStack>
      <SSHStack justifyBetween>
        <SSHStack gap="xs" style={styles.amountRow}>
          <SSText size="sm">
            {formatNumber(satsToFiat(utxo.value, btcPrice, fiatEnabled), 2)}
          </SSText>
          <SSText size="sm" color="muted">
            {fiatCurrency}
          </SSText>
        </SSHStack>
        <SSText size="sm" color="muted">
          {utxo.timestamp ? formatDate(utxo.timestamp) : ''}
        </SSText>
      </SSHStack>
      {label ? <SSText size="sm">{label}</SSText> : null}
      <SSButton
        variant="outline"
        label={t('utxo.exclude.include')}
        onPress={handleInclude}
      />
    </SSVStack>
  )
}

function listSeparator() {
  return <SSSeparator color="grayDark" />
}

export default function ExcludeUtxos() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const display = useDisplayPreferences()
  const account = useAccountsStore(
    (state) => state.accounts.find((entry) => entry.id === id)!
  )

  const excludedSet = account.excludedUtxoOutpoints
    ? new Set(account.excludedUtxoOutpoints)
    : new Set<string>()
  const excludedUtxos = account.utxos.filter((utxo) =>
    excludedSet.has(getUtxoOutpoint(utxo))
  )

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('utxo.exclude.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack gap="sm" style={styles.container}>
          <SSText size="sm" color="muted">
            {excludedUtxos.length === 0
              ? t('utxo.exclude.empty')
              : t('utxo.exclude.count', { count: excludedUtxos.length })}
          </SSText>
          {excludedUtxos.length > 0 ? (
            <View style={styles.list}>
              <FlashList
                data={excludedUtxos}
                keyExtractor={getUtxoOutpoint}
                ItemSeparatorComponent={listSeparator}
                renderItem={({ item }) => (
                  <SSExcludedUtxoRow
                    {...display}
                    utxo={item}
                    accountId={account.id}
                  />
                )}
              />
            </View>
          ) : null}
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  amountRow: {
    alignItems: 'baseline'
  },
  container: {
    flex: 1
  },
  list: {
    flex: 1
  },
  row: {
    paddingVertical: Layout.vStack.gap.md
  }
})
