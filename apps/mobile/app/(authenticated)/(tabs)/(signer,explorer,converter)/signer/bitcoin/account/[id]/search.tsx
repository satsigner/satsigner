import { Slider } from '@miblanchard/react-native-slider'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  View
} from 'react-native'

import SSButton from '@/components/SSButton'
import SSDatePicker from '@/components/SSDatePicker'
import SSRadioButton from '@/components/SSRadioButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTransactionCard from '@/components/SSTransactionCard'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatDate } from '@/utils/format'
import {
  type TransactionDirection,
  dateToDayIndex,
  describeActiveFilters,
  dayIndexToDate,
  filterTransactions,
  getTransactionDateBounds,
  getTransactionTags,
  toggleTag
} from '@/utils/transactionSearch'

type DateEdge = 'from' | 'to'
type DateInputMode = 'calendar' | 'slider'

const BITCOIN_GENESIS_YEAR = 2009
const DATE_PICKER_HEIGHT = 160
const DATE_PICKER_MARK_HEIGHT = 40
const SLIDER_STEP_DAYS = 1
// FlashList keeps the on-screen item anchored when results change, which
// pushes the list mid-scroll as filters widen. Results should start at the top.
const DISABLED_CONTENT_POSITION = { disabled: true }
const SCROLL_EVENT_THROTTLE_MS = 16
const DIRECTION_OPTIONS = [
  { direction: undefined, labelKey: 'account.search.directionAll' },
  { direction: 'send', labelKey: 'account.search.directionSent' },
  { direction: 'receive', labelKey: 'account.search.directionReceived' }
] as const satisfies {
  direction: TransactionDirection | undefined
  labelKey: string
}[]

export default function AccountTransactionSearchPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const account = useAccountsStore((state) =>
    state.accounts.find((a) => a.id === id)
  )
  const blockHeight = useBlockchainStore((state) => state.lastKnownBlockHeight)
  const display = useDisplayPreferences()

  const [query, setQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [direction, setDirection] = useState<TransactionDirection>()
  const [dateRange, setDateRange] = useState<
    Record<DateEdge, Date | undefined>
  >({ from: undefined, to: undefined })
  const [editingEdge, setEditingEdge] = useState<DateEdge>()
  const [dateInputMode, setDateInputMode] = useState<DateInputMode>('calendar')
  const resultsListRef = useRef<FlashListRef<Transaction>>(null)
  const [filtersHeight, setFiltersHeight] = useState(0)
  const [isPastFilters, setIsPastFilters] = useState(false)

  if (!account || !id) {
    return <Redirect href="/" />
  }

  const availableTags = getTransactionTags(account.transactions)
  const dateBounds = getTransactionDateBounds(account.transactions)
  const isSliderMode = dateInputMode === 'slider' && dateBounds !== undefined
  const activeFilters = {
    direction,
    from: dateRange.from,
    query,
    tags: selectedTags,
    to: dateRange.to
  }
  const results = filterTransactions(account.transactions, activeFilters)
  const filterSummary = describeActiveFilters(activeFilters)
  const hasFilters = filterSummary.length > 0
  const showPinnedFilters = hasFilters && isPastFilters

  function handleFiltersLayout(event: LayoutChangeEvent) {
    setFiltersHeight(event.nativeEvent.layout.height)
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIsPastFilters(event.nativeEvent.contentOffset.y > filtersHeight)
  }

  function handleToggleEdge(edge: DateEdge) {
    setEditingEdge((current) => (current === edge ? undefined : edge))
    setDateRange((range) => ({ ...range, [edge]: range[edge] ?? new Date() }))
  }

  function handleDateChange(date: Date) {
    if (!editingEdge) {
      return
    }
    setDateRange((range) => ({ ...range, [editingEdge]: date }))
  }

  function handleClearEdge() {
    if (!editingEdge) {
      return
    }
    setDateRange((range) => ({ ...range, [editingEdge]: undefined }))
    setEditingEdge(undefined)
  }

  function handleToggleDateInputMode() {
    setEditingEdge(undefined)
    setDateInputMode((mode) => (mode === 'slider' ? 'calendar' : 'slider'))
  }

  function handleSliderChange([fromIndex, toIndex]: number[]) {
    if (!dateBounds) {
      return
    }
    const { dayCount, first } = dateBounds
    setDateRange({
      from: fromIndex > 0 ? dayIndexToDate(first, fromIndex) : undefined,
      to: toIndex < dayCount ? dayIndexToDate(first, toIndex) : undefined
    })
  }

  function sliderValue(bounds: NonNullable<typeof dateBounds>) {
    const fromIndex = dateRange.from
      ? Math.max(0, dateToDayIndex(bounds.first, dateRange.from))
      : 0
    const toIndex = dateRange.to
      ? Math.min(bounds.dayCount, dateToDayIndex(bounds.first, dateRange.to))
      : bounds.dayCount
    return [fromIndex, toIndex]
  }

  function handleClearAll() {
    setQuery('')
    setDirection(undefined)
    setSelectedTags([])
    setDateRange({ from: undefined, to: undefined })
    setEditingEdge(undefined)
    setIsPastFilters(false)
    resultsListRef.current?.scrollToOffset({ animated: false, offset: 0 })
  }

  function handleOpenTransaction(txid: string) {
    router.navigate(`/signer/bitcoin/account/${id}/transaction/${txid}`)
  }

  function handleOpenFiatSettings() {
    router.navigate('/settings/features/fiatData')
  }

  function edgeLabel(edge: DateEdge) {
    const date = dateRange[edge]
    const value = date ? formatDate(date) : t('account.search.anyDate')
    return `${t(`account.search.${edge}`)}: ${value}`
  }

  function renderTransaction({ item }: { item: Transaction }) {
    return (
      <SSTransactionCard
        {...display}
        transaction={item}
        expand={false}
        blockHeight={blockHeight}
        onPress={() => handleOpenTransaction(item.id)}
        onOpenFiatSettings={handleOpenFiatSettings}
      />
    )
  }

  const filters = (
    <SSVStack gap="md" style={styles.filters} onLayout={handleFiltersLayout}>
      <SSTextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('account.search.placeholder')}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <SSHStack gap="xs">
        {DIRECTION_OPTIONS.map((option) => (
          <SSRadioButton
            key={option.labelKey}
            variant="outline"
            label={t(option.labelKey)}
            selected={direction === option.direction}
            onPress={() => setDirection(option.direction)}
            style={styles.edgeButton}
          />
        ))}
      </SSHStack>

      {availableTags.length > 0 ? (
        <SSVStack gap="xs">
          <SSText color="muted" size="xs" uppercase>
            {t('account.search.tags')}
          </SSText>
          <SSHStack gap="xs" style={styles.wrap}>
            {availableTags.map((tag) => (
              <SSRadioButton
                key={tag}
                variant="outline"
                label={`#${tag}`}
                selected={selectedTags.includes(tag)}
                onPress={() => setSelectedTags((tags) => toggleTag(tags, tag))}
                style={styles.tagButton}
              />
            ))}
          </SSHStack>
        </SSVStack>
      ) : null}

      <SSVStack gap="xs">
        <SSHStack justifyBetween>
          <SSText color="muted" size="xs" uppercase>
            {t('account.search.dateRange')}
          </SSText>
          {dateBounds ? (
            <SSText size="xs" uppercase onPress={handleToggleDateInputMode}>
              {isSliderMode
                ? t('account.search.useCalendar')
                : t('account.search.useSlider')}
            </SSText>
          ) : null}
        </SSHStack>
        {isSliderMode ? (
          <SSVStack gap="none">
            <Slider
              minimumValue={0}
              maximumValue={dateBounds.dayCount}
              step={SLIDER_STEP_DAYS}
              value={sliderValue(dateBounds)}
              onValueChange={handleSliderChange}
              containerStyle={styles.slider}
              minimumTrackTintColor={Colors.gray[400]}
              maximumTrackTintColor={Colors.gray[800]}
              trackStyle={styles.sliderTrack}
              thumbTintColor={Colors.white}
              thumbStyle={styles.sliderThumb}
            />
            <SSHStack justifyBetween>
              <SSText size="sm">
                {formatDate(dateRange.from ?? dateBounds.first)}
              </SSText>
              <SSText size="sm">
                {formatDate(
                  dateRange.to ??
                    dayIndexToDate(dateBounds.first, dateBounds.dayCount)
                )}
              </SSText>
            </SSHStack>
          </SSVStack>
        ) : (
          <>
            <SSHStack gap="xs">
              <SSRadioButton
                variant="outline"
                label={edgeLabel('from')}
                selected={editingEdge === 'from'}
                onPress={() => handleToggleEdge('from')}
                style={styles.edgeButton}
              />
              <SSRadioButton
                variant="outline"
                label={edgeLabel('to')}
                selected={editingEdge === 'to'}
                onPress={() => handleToggleEdge('to')}
                style={styles.edgeButton}
              />
            </SSHStack>
            {editingEdge ? (
              <SSVStack gap="xs">
                <View style={styles.pickerWrap}>
                  <SSDatePicker
                    key={editingEdge}
                    value={dateRange[editingEdge]}
                    onChange={handleDateChange}
                    width="90%"
                    height={DATE_PICKER_HEIGHT}
                    fontSize={Sizes.text.fontSize.xl}
                    textColor={Colors.white}
                    fadeColor={Colors.gray[950]}
                    markColor={Colors.gray[950]}
                    markHeight={DATE_PICKER_MARK_HEIGHT}
                    startYear={BITCOIN_GENESIS_YEAR}
                  />
                </View>
                <SSButton
                  label={t('account.search.clearDate')}
                  variant="ghost"
                  onPress={handleClearEdge}
                />
              </SSVStack>
            ) : null}
          </>
        )}
      </SSVStack>

      <SSHStack justifyBetween style={styles.summary}>
        <SSText color="muted" size="sm">
          {t('account.search.results', { count: results.length })}
        </SSText>
        {hasFilters ? (
          <SSText size="sm" onPress={handleClearAll}>
            {t('account.search.clearAll')}
          </SSText>
        ) : null}
      </SSHStack>
    </SSVStack>
  )

  return (
    <SSMainLayout style={styles.layout}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.search.title')}</SSText>
          )
        }}
      />
      <View style={styles.listWrap}>
        <FlashList
          ref={resultsListRef}
          onScroll={handleScroll}
          scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
          data={results}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={filters}
          maintainVisibleContentPosition={DISABLED_CONTENT_POSITION}
          ListEmptyComponent={
            <SSText color="muted" center style={styles.empty}>
              {t('account.search.empty')}
            </SSText>
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
        {showPinnedFilters ? (
          <SSHStack gap="sm" justifyBetween style={styles.pinnedFilters}>
            <SSText size="sm" numberOfLines={1} style={styles.pinnedSummary}>
              {filterSummary.join(' · ')}
            </SSText>
            <SSText size="sm" onPress={handleClearAll}>
              {t('account.search.clear')}
            </SSText>
          </SSHStack>
        ) : null}
      </View>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  edgeButton: { flex: 1 },
  empty: { paddingTop: 40 },
  filters: { paddingBottom: 12 },
  layout: { paddingBottom: 0 },
  listWrap: { flex: 1 },
  pickerWrap: { alignItems: 'center' },
  pinnedFilters: {
    alignItems: 'center',
    backgroundColor: Colors.gray[950],
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    left: 0,
    paddingVertical: 10,
    position: 'absolute',
    right: 0,
    top: 0
  },
  pinnedSummary: { flex: 1 },
  slider: { width: '100%' },
  sliderThumb: { borderRadius: 11, height: 22, width: 22 },
  sliderTrack: { borderRadius: 6, height: 6 },
  summary: {
    borderBottomColor: Colors.gray[900],
    borderBottomWidth: 1,
    paddingBottom: 8
  },
  tagButton: { paddingHorizontal: 12 },
  wrap: { flexWrap: 'wrap' }
})
