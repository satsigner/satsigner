import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconBubbles } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSText from '@/components/SSText'
import SSUtxoItem from '@/components/SSUtxoItem'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { Colors } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { compareAmount, compareTimestamp } from '@/utils/sort'

type SortField = 'date' | 'amount'

export default function SelectUtxoList() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [inputs, getInputs, hasInput, addInput, removeInput] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.getInputs,
        state.hasInput,
        state.addInput,
        state.removeInput
      ])
    )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [getCurrentAccount] = useAccountsStore(
    useShallow((state) => [state.getCurrentAccount])
  )
  const account = getCurrentAccount(id!)

  const [sortDirection, setSortDirection] = useState<Direction>('desc')
  const [sortField, setSortField] = useState<SortField>('amount')

  const hasSelectedUtxos = inputs.size > 0
  const selectedAllUtxos = inputs.size === account?.utxos.length

  const largestValue = useMemo(
    () => Math.max(...account.utxos.map((utxo: Utxo) => utxo.value)),
    [account.utxos]
  )

  const utxosValue = (utxos: Utxo[]): number =>
    utxos.reduce((acc, utxo) => acc + utxo.value, 0)

  const utxosTotalValue = useMemo(
    () => utxosValue(account.utxos),
    [account.utxos]
  )
  const utxosSelectedValue = utxosValue(getInputs())

  function handleSelectAllUtxos() {
    for (const utxo of account.utxos) {
      addInput(utxo)
    }
  }

  function handleDeselectAllUtxos() {
    for (const utxo of account.utxos) {
      removeInput(utxo)
    }
  }

  function sortUtxos(utxos: Utxo[]) {
    return utxos.sort((utxo1, utxo2) =>
      sortDirection === 'asc'
        ? sortField === 'date'
          ? compareTimestamp(utxo1.timestamp, utxo2.timestamp)
          : compareTimestamp(utxo2.timestamp, utxo1.timestamp)
        : sortField === 'date'
          ? compareAmount(utxo1.value, utxo2.value)
          : compareAmount(utxo2.value, utxo1.value)
    )
  }

  function handleOnDirectionChanged(field: SortField, direction: Direction) {
    setSortField(field)
    setSortDirection(direction)
  }

  function handleOnToggleSelected(utxo: Utxo) {
    const includesInput = hasInput(utxo)

    if (includesInput) removeInput(utxo)
    else addInput(utxo)
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{id}</SSText>
        }}
      />
      <SSMainLayout style={{ flex: 0 }}>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSText color="muted">Group</SSText>
            <SSText size="md">
              {i18n.t('signAndSend.selectSpendableOutputs')}
            </SSText>
            <SSIconButton
              onPress={() =>
                router.navigate(`/account/${id}/signAndSend/selectUtxoBubbles`)
              }
            >
              <SSIconBubbles height={22} width={24} />
            </SSIconButton>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {i18n.t('common.of').toLowerCase()}{' '}
                {account?.utxos.length}{' '}
                {i18n.t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(satsToFiat(utxosTotalValue), 2)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
            <SSVStack itemsCenter gap="none">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue)}
                </SSText>
                <SSText size="xl" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="muted">
                  {formatNumber(satsToFiat(utxosSelectedValue), 2)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
      <SSSeparator color="grayDark" style={{ width: '100%', marginTop: 12 }} />
      <SSHStack justifyBetween style={{ paddingHorizontal: '5%' }}>
        <SSButton
          variant="ghost"
          label={`${selectedAllUtxos ? i18n.t('common.deselectAll').toUpperCase() : i18n.t('common.selectAll').toUpperCase()} ${formatNumber(utxosTotalValue)} ${i18n.t('bitcoin.sats').toLowerCase()}`}
          style={{ width: 'auto' }}
          textStyle={{
            color: Colors.gray[75],
            textTransform: 'none',
            textDecorationLine: 'underline'
          }}
          onPress={() =>
            selectedAllUtxos ? handleDeselectAllUtxos() : handleSelectAllUtxos()
          }
        />
        <SSHStack gap="sm">
          <SSSortDirectionToggle
            label={i18n.t('common.date')}
            showArrow={sortField === 'date'}
            onDirectionChanged={(direction) =>
              handleOnDirectionChanged('date', direction)
            }
          />
          <SSSortDirectionToggle
            label={i18n.t('common.amount')}
            showArrow={sortField === 'amount'}
            onDirectionChanged={(direction) =>
              handleOnDirectionChanged('amount', direction)
            }
          />
        </SSHStack>
      </SSHStack>
      <View>
        <View style={styles.scrollBackgroundBase} />
        <ScrollView
          contentContainerStyle={{
            paddingBottom: Platform.OS === 'android' ? 356 : 286
          }}
        >
          <View style={{ marginTop: 2 }}>
            {sortUtxos([...account.utxos]).map((utxo) => (
              <SSUtxoItem
                key={`${utxo.txid}:${utxo.vout}`}
                utxo={utxo}
                selected={hasInput(utxo)}
                onToggleSelected={handleOnToggleSelected}
                largestValue={largestValue}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      <SSMainLayout style={styles.absoluteSubmitContainer}>
        <SSButton
          label={i18n.t('signAndSend.addAsInputToMessage')}
          variant="secondary"
          disabled={!hasSelectedUtxos}
          style={[
            { width: '92%', opacity: 100 },
            !hasSelectedUtxos && {
              backgroundColor: Colors.gray[700]
            }
          ]}
          textStyle={[!hasSelectedUtxos && { color: Colors.gray[400] }]}
          onPress={() =>
            router.navigate(`/account/${id}/signAndSend/ioPreview`)
          }
        />
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  scrollBackgroundBase: {
    position: 'absolute',
    width: '100%',
    backgroundColor: Colors.gray[900],
    top: 2,
    height: 1000
  },
  absoluteSubmitContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: Colors.transparent,
    paddingHorizontal: 0,
    paddingTop: 0
  }
})
