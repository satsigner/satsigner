import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useHeaderHeight } from 'expo-router/react-navigation'
import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { SSIconExclude, SSIconFilter, SSIconList } from '@/components/icons'
import SSBubbleChart from '@/components/SSBubbleChart'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
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
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'
import {
  applyUtxoDenylist,
  DEFAULT_UTXO_LIST_FILTER,
  filterUtxos,
  type UtxoKeychainFilter,
  type UtxoLabelFilter,
  type UtxoListFilter,
  type UtxoScriptFilter,
  type UtxoTagFilter
} from '@/utils/utxoList'

function SelectUtxoBubbles() {
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
  const [inputs, addInput, removeInput] = useTransactionBuilderStore(
    useShallow((state) => [state.inputs, state.addInput, state.removeInput])
  )
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const topHeaderHeight = useHeaderHeight()
  const { width, height } = useWindowDimensions()
  const GRAPH_HEIGHT = height - topHeaderHeight + 20
  const GRAPH_WIDTH = width

  const [customAmountModalVisible, setCustomAmountModalVisible] =
    useState(false)
  const [filter, setFilter] = useState<UtxoListFilter>(DEFAULT_UTXO_LIST_FILTER)
  const [controlsModalVisible, setControlsModalVisible] = useState(false)
  const [groupMode, setGroupMode] = useUtxoListControlsStore(
    useShallow((state) => [state.groupMode, state.setGroupMode])
  )

  const excludedOutpoints = account.excludedUtxoOutpoints
  const excludedCount = excludedOutpoints?.length ?? 0
  const selectableUtxos = filterUtxos(
    applyUtxoDenylist(account.utxos, excludedOutpoints ?? []),
    filter
  )

  const hasSelectedUtxos = inputs.size > 0
  const selectedAllUtxos =
    selectableUtxos.length > 0 &&
    selectableUtxos.every((utxo) => inputs.has(getUtxoOutpoint(utxo)))

  function utxosValue(utxos: Utxo[]): number {
    return utxos.reduce((acc, utxo) => acc + utxo.value, 0)
  }

  const utxosTotalValue = utxosValue(selectableUtxos)
  const utxosSelectedValue = utxosValue(Array.from(inputs.values()))
  const controlsActive =
    filter.keychain !== 'all' ||
    filter.label !== 'all' ||
    filter.script !== 'all' ||
    filter.tag !== 'all' ||
    groupMode !== 'none'

  function handleOnToggleSelected(utxo: Utxo) {
    const includesInput = inputs.has(getUtxoOutpoint(utxo))

    if (includesInput) {
      removeInput(utxo)
    } else {
      addInput(utxo)
    }
  }

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

  function setKeychainFilter(keychain: UtxoKeychainFilter) {
    setFilter((prev) => ({ ...prev, keychain }))
  }

  function setLabelFilter(label: UtxoLabelFilter) {
    setFilter((prev) => ({ ...prev, label }))
  }

  function setTagFilter(tag: UtxoTagFilter) {
    setFilter((prev) => ({ ...prev, tag }))
  }

  function setScriptFilter(script: UtxoScriptFilter) {
    setFilter((prev) => ({ ...prev, script }))
  }

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        style={styles.absoluteTopContainer}
        locations={[0.185, 0.5554, 0.7713, 1]}
        colors={['#0A0A0AF5', '#0A0A0AA6', '#0A0A0A4B', '#0A0A0A00']}
      >
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
                    `/signer/bitcoin/account/${id}/signAndSend/selectUtxoList`
                  )
                }
              >
                <SSIconList height={15} width={15} />
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
                <SSText
                  size="7xl"
                  color="white"
                  weight="ultralight"
                  style={{ lineHeight: 62 }}
                >
                  {formatNumber(utxosSelectedValue, 0, zeroPadding)}
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
      </LinearGradient>
      <SSBubbleChart
        utxos={selectableUtxos}
        canvasSize={{ height: GRAPH_HEIGHT, width: GRAPH_WIDTH }}
        inputs={Array.from(inputs.values())}
        onPress={handleOnToggleSelected}
        groupMode={groupMode}
        style={{ position: 'absolute', top: 40 }}
      />
      <LinearGradient
        locations={[0, 0.1255, 0.2678, 1]}
        style={[
          styles.absoluteSubmitContainer,
          { paddingBottom: 20 + insets.bottom }
        ]}
        colors={['#0A0A0A00', '#0A0A0A0F', '#0A0A0A2A', '#0A0A0A']}
      >
        <SSVStack style={{ width: '92%' }}>
          <SSHStack justifyBetween>
            <SSButton
              label={t('transaction.build.select.customAmount')}
              variant="ghost"
              style={{ height: 'auto', width: 'auto' }}
              onPress={() => setCustomAmountModalVisible(true)}
            />
            <SSButton
              label={
                selectedAllUtxos
                  ? t('common.deselectAll')
                  : t('common.selectAll')
              }
              variant="ghost"
              style={{ height: 'auto', width: 'auto' }}
              onPress={() =>
                selectedAllUtxos
                  ? handleDeselectAllUtxos()
                  : handleSelectAllUtxos()
              }
            />
          </SSHStack>
          <SSButton
            label={t('transaction.build.add.inputs.title.2')}
            variant="secondary"
            disabled={!hasSelectedUtxos}
            style={[
              { opacity: 100 },
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
        </SSVStack>
      </LinearGradient>
      <SSModal
        visible={customAmountModalVisible}
        onClose={() => setCustomAmountModalVisible(false)}
      >
        <SSVStack>
          <SSText size="lg" uppercase center style={{ maxWidth: 240 }}>
            {t('transaction.build.type.customAmount')}
          </SSText>
        </SSVStack>
      </SSModal>
      <SSUtxoListControlsModal
        visible={controlsModalVisible}
        filter={filter}
        groupMode={groupMode}
        onClose={() => setControlsModalVisible(false)}
        onReset={() => {
          setFilter(DEFAULT_UTXO_LIST_FILTER)
          setGroupMode('none')
        }}
        onKeychainChange={setKeychainFilter}
        onLabelChange={setLabelFilter}
        onScriptChange={setScriptFilter}
        onTagChange={setTagFilter}
        onGroupModeChange={setGroupMode}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  absoluteSubmitContainer: {
    backgroundColor: Colors.transparent,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingTop: 0,
    position: 'absolute',
    width: '100%'
  },
  absoluteTopContainer: {
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: Layout.mainContainer.paddingTop,
    position: 'absolute',
    width: '100%',
    zIndex: 20
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
  }
})

export default SelectUtxoBubbles
