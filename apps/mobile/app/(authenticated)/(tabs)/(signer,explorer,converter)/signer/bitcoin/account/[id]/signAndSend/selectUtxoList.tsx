import { FlashList } from '@shopify/flash-list'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { SSIconBubbles, SSIconExclude, SSIconFilter } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSSeparator from '@/components/SSSeparator'
import SSSortDirectionToggle from '@/components/SSSortDirectionToggle'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSUtxoItem from '@/components/SSUtxoItem'
import SSUtxoListControlsModal from '@/components/SSUtxoListControlsModal'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useUtxoListControlsStore } from '@/store/utxoListControls'
import { Colors, Layout } from '@/styles'
import { type Direction } from '@/types/logic/sort'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { toggleUtxoExcluded } from '@/utils/excludeUtxo'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'
import {
  DEFAULT_UTXO_LIST_FILTER,
  isUtxoExcluded,
  prepareUtxoList,
  type UtxoKeychainFilter,
  type UtxoLabelFilter,
  type UtxoListFilter,
  type UtxoSortField
} from '@/utils/utxoList'
import {
  groupDisplayTitle,
  UTXO_SORT_FIELDS,
  utxoSortFieldLabel
} from '@/utils/utxoListUi'

type ListRow =
  | { type: 'header'; key: string; title: string }
  | { type: 'utxo'; key: string; utxo: Utxo }

export default function SelectUtxoList() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const insets = useSafeAreaInsets()

  const account = useAccountsStore(
    (state) => state.accounts.find((entry) => entry.id === id)!
  )
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
  const zeroPadding = useZeroPadding || currencyUnit === 'btc'
  const [inputs, hasInput, addInput, removeInput] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.hasInput,
      state.addInput,
      state.removeInput
    ])
  )
  const [groupMode, sortField, sortDirection, setGroupMode, setSort] =
    useUtxoListControlsStore(
      useShallow((state) => [
        state.groupMode,
        state.sortField,
        state.sortDirection,
        state.setGroupMode,
        state.setSort
      ])
    )

  const excludedOutpoints = account.excludedUtxoOutpoints
  const excludedCount = excludedOutpoints?.length ?? 0
  const utxoOutpointSet = new Set(account.utxos.map(getUtxoOutpoint))
  const orphanedInputs = Array.from(inputs.values()).filter(
    (utxo) => !utxoOutpointSet.has(getUtxoOutpoint(utxo))
  )

  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const [filter, setFilter] = useState<UtxoListFilter>(DEFAULT_UTXO_LIST_FILTER)
  const [controlsModalVisible, setControlsModalVisible] = useState(false)

  const groups = prepareUtxoList({
    excludedOutpoints: excludedOutpoints ?? [],
    filter,
    groupMode,
    hideExcluded: false,
    sortDirection,
    sortField,
    utxos: account.utxos
  })

  const listRows: ListRow[] = []
  for (const group of groups) {
    if (groupMode !== 'none') {
      listRows.push({
        key: `header:${group.key}`,
        title: groupDisplayTitle(groupMode, group.key, group.title),
        type: 'header'
      })
    }
    for (const utxo of group.utxos) {
      listRows.push({
        key: getUtxoOutpoint(utxo),
        type: 'utxo',
        utxo
      })
    }
  }

  const visibleUtxos = groups.flatMap((group) => group.utxos)
  const selectableUtxos = visibleUtxos.filter(
    (utxo) => !isUtxoExcluded(utxo, excludedOutpoints ?? [])
  )

  const hasSelectedUtxos = inputs.size > 0
  const selectedAllUtxos =
    selectableUtxos.length > 0 &&
    selectableUtxos.every((utxo) => hasInput(utxo))
  const selectedCount = inputs.size

  function buttonLabel() {
    if (!hasSelectedUtxos) {
      return t('transaction.build.add.inputs.button.noSelection')
    }
    if (selectedAllUtxos) {
      return t('transaction.build.add.inputs.button.allSelected')
    }
    if (selectedCount === 1) {
      return t('transaction.build.add.inputs.button.oneSelected')
    }
    return t('transaction.build.add.inputs.button.multipleSelected', {
      count: selectedCount
    })
  }

  const largestValue = Math.max(0, ...account.utxos.map((utxo) => utxo.value))

  function utxosValue(utxos: Utxo[]): number {
    return utxos.reduce((acc, utxo) => acc + utxo.value, 0)
  }

  const utxosTotalValue = utxosValue(selectableUtxos)
  const utxosSelectedValue = utxosValue(Array.from(inputs.values()))

  function handleSelectAllUtxos() {
    for (const utxo of selectableUtxos) {
      addInput(utxo)
    }
  }

  function handleDeselectAllUtxos() {
    for (const utxo of selectableUtxos) {
      removeInput(utxo)
    }
  }

  function handleOnDirectionChanged(
    field: UtxoSortField,
    direction: Direction
  ) {
    setSort(field, direction)
  }

  function handleOnToggleSelected(utxo: Utxo) {
    if (isUtxoExcluded(utxo, excludedOutpoints ?? []) && !hasInput(utxo)) {
      return
    }
    if (hasInput(utxo)) {
      removeInput(utxo)
    } else {
      addInput(utxo)
    }
  }

  function handleToggleExcluded(utxo: Utxo) {
    if (hasInput(utxo)) {
      removeInput(utxo)
    }
    toggleUtxoExcluded(account.id, utxo)
  }

  function setKeychainFilter(keychain: UtxoKeychainFilter) {
    setFilter((prev) => ({ ...prev, keychain }))
  }

  function setLabelFilter(label: UtxoLabelFilter) {
    setFilter((prev) => ({ ...prev, label }))
  }

  const controlsActive =
    filter.keychain !== 'all' || filter.label !== 'all' || groupMode !== 'none'

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.headerContainer}>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSIconButton
              onPress={() =>
                router.navigate(
                  `/signer/bitcoin/account/${id}/signAndSend/excludeUtxos`
                )
              }
              style={styles.badgeButton}
            >
              <SSIconExclude height={16} width={16} />
              {excludedCount > 0 ? (
                <View style={styles.excludeBadge}>
                  <SSText size="xxs" style={styles.excludeBadgeText}>
                    {excludedCount}
                  </SSText>
                </View>
              ) : null}
            </SSIconButton>
            <SSText size="md">
              {t('transaction.build.select.spendableOutputs')}
            </SSText>
            <SSHStack gap="sm">
              <SSIconButton
                onPress={() => setControlsModalVisible(true)}
                style={styles.badgeButton}
              >
                <SSIconFilter height={16} width={16} />
                {controlsActive ? <View style={styles.badgeDot} /> : null}
              </SSIconButton>
              <SSIconButton
                onPress={() =>
                  router.navigate(
                    `/signer/bitcoin/account/${id}/signAndSend/selectUtxoBubbles`
                  )
                }
              >
                <SSIconBubbles height={15} width={15} />
              </SSIconButton>
            </SSHStack>
          </SSHStack>
          <SSVStack itemsCenter gap="sm">
            <SSVStack itemsCenter gap="xs">
              <SSText>
                {inputs.size} {t('common.of').toLowerCase()}{' '}
                {selectableUtxos.length} {t('common.selected').toLowerCase()}
              </SSText>
              <SSHStack gap="xs">
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {t('common.total')}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[75] }}>
                  {formatNumber(utxosTotalValue, 0, zeroPadding)}
                </SSText>
                <SSText size="xxs" style={{ color: Colors.gray[400] }}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
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
                <SSText size="7xl" color="white" style={{ lineHeight: 62 }}>
                  <SSStyledSatText
                    amount={utxosSelectedValue || 0}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    textSize="7xl"
                    weight="ultralight"
                    letterSpacing={-1}
                  />
                </SSText>
                <SSText size="xl" color="muted">
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
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
      </View>
      <SSSeparator color="grayDark" style={{ marginTop: 12, width: '100%' }} />
      <SSHStack
        justifyBetween
        style={{
          alignItems: 'center',
          borderBottomColor: Colors.gray[900],
          borderBottomWidth: 1,
          paddingHorizontal: '5%',
          width: '100%'
        }}
      >
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <SSButton
            variant="ghost"
            label={`${
              selectedAllUtxos
                ? t('common.deselectAll').toUpperCase()
                : t('common.selectAll').toUpperCase()
            } ${formatNumber(utxosTotalValue, 0, zeroPadding)} ${
              currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')
            }`}
            style={{ alignSelf: 'flex-start', width: undefined }}
            textStyle={{
              color: Colors.gray[75],
              textAlign: 'left',
              textDecorationLine: 'underline',
              textTransform: 'none'
            }}
            onPress={() =>
              selectedAllUtxos
                ? handleDeselectAllUtxos()
                : handleSelectAllUtxos()
            }
          />
        </View>
        <SSHStack gap="sm" style={{ flexShrink: 0 }}>
          {UTXO_SORT_FIELDS.map((field) => (
            <SSSortDirectionToggle
              key={field}
              label={utxoSortFieldLabel(field)}
              active={sortField === field}
              onDirectionChanged={(direction) =>
                handleOnDirectionChanged(field, direction)
              }
            />
          ))}
        </SSHStack>
      </SSHStack>
      {orphanedInputs.length > 0 && (
        <View>
          <SSHStack
            style={{
              backgroundColor: Colors.gray[900],
              paddingHorizontal: '5%',
              paddingVertical: 8
            }}
          >
            <SSText size="xs" style={{ color: Colors.error }}>
              {t('transaction.orphanedInputs.sectionTitle')}
            </SSText>
          </SSHStack>
          {orphanedInputs.map((utxo) => (
            <View key={getUtxoOutpoint(utxo)} style={{ opacity: 0.6 }}>
              <SSUtxoItem
                utxo={utxo}
                selected
                onToggleSelected={removeInput}
                largestValue={utxo.value}
              />
            </View>
          ))}
          <SSSeparator color="grayDark" style={{ width: '100%' }} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <FlashList
          data={listRows}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.groupHeader}>
                  <SSText size="xs" color="muted" uppercase>
                    {item.title}
                  </SSText>
                </View>
              )
            }
            const idx = account.addresses.findIndex(
              (a) =>
                (a.address || '').trim() === (item.utxo.addressTo || '').trim()
            )
            const addressEntry = idx !== -1 ? account.addresses[idx] : null
            const addressIndex =
              addressEntry !== null ? (addressEntry.index ?? idx) : undefined
            return (
              <SSUtxoItem
                utxo={item.utxo}
                selected={inputs.has(getUtxoOutpoint(item.utxo))}
                onToggleSelected={handleOnToggleSelected}
                onToggleExcluded={handleToggleExcluded}
                excluded={isUtxoExcluded(item.utxo, excludedOutpoints ?? [])}
                largestValue={largestValue}
                addressIndex={addressIndex}
              />
            )
          }}
          contentContainerStyle={{ paddingBottom: 80 + insets.bottom }}
        />
      </View>
      <View
        style={[styles.absoluteSubmitContainer, { bottom: 20 + insets.bottom }]}
      >
        <SSButton
          label={buttonLabel()}
          variant="secondary"
          disabled={!hasSelectedUtxos}
          style={[
            { opacity: 100, width: '92%' },
            !hasSelectedUtxos && {
              backgroundColor: Colors.gray[700]
            }
          ]}
          textStyle={!hasSelectedUtxos && { color: Colors.gray[400] }}
          onPress={() =>
            router.navigate(
              `/signer/bitcoin/account/${id}/signAndSend/ioPreview`
            )
          }
        />
      </View>
      <SSUtxoListControlsModal
        visible={controlsModalVisible}
        filter={filter}
        groupMode={groupMode}
        onClose={() => setControlsModalVisible(false)}
        onKeychainChange={setKeychainFilter}
        onLabelChange={setLabelFilter}
        onGroupModeChange={setGroupMode}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  absoluteSubmitContainer: {
    alignItems: 'center',
    position: 'absolute',
    width: '100%'
  },
  badgeButton: {
    position: 'relative'
  },
  badgeDot: {
    backgroundColor: Colors.white,
    borderRadius: 3,
    height: 6,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 6
  },
  excludeBadge: {
    alignItems: 'center',
    backgroundColor: Colors.error,
    borderRadius: 7,
    height: 14,
    justifyContent: 'center',
    minWidth: 14,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4
  },
  excludeBadgeText: {
    color: Colors.white,
    lineHeight: 12
  },
  groupHeader: {
    backgroundColor: Colors.gray[900],
    paddingHorizontal: '5%',
    paddingVertical: 8
  },
  headerContainer: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop
  }
})
