import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Network } from 'react-native-bdk-sdk'

import SSBubbleChart from '@/components/SSBubbleChart'
import SSCurrentTransactionChart from '@/components/SSCurrentTransactionChart'
import SSDesignSection from '@/components/SSDesignSection'
import SSDevConsolePanel, {
  type DevConsolePanelActions
} from '@/components/SSDevConsolePanel'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSKeyboard from '@/components/SSKeyboard'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSLightningChannelLiquidityBar from '@/components/SSLightningChannelLiquidityBar'
import SSLightningChannelsBubbleChart from '@/components/SSLightningChannelsBubbleChart'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
import SSPinInput from '@/components/SSPinInput'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeedWordsEntry from '@/components/SSSeedWordsEntry'
import SSSeparator from '@/components/SSSeparator'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSTagInput from '@/components/SSTagInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTransactionCard from '@/components/SSTransactionCard'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSUtxoBar from '@/components/SSUtxoBar'
import SSUtxoCard from '@/components/SSUtxoCard'
import { PIN_SIZE } from '@/config/auth'
import {
  DESIGN_CHANNEL_SETS,
  DESIGN_FEATURE_SET_NAMES,
  DESIGN_HISTORY_SETS,
  DESIGN_LOG_SETS,
  DESIGN_SAMPLE_SET_LABEL_KEYS,
  DESIGN_SANKEY_SETS,
  DESIGN_TAG_STATES,
  DESIGN_TRANSACTION_CARD_STATES,
  DESIGN_TRANSACTION_CHART_SETS,
  DESIGN_UTXO_SETS,
  DESIGN_WORD_STATES,
  type DesignSampleSetName
} from '@/constants/designSampleVariations'
import {
  DESIGN_SAMPLE_BLOCK_HEIGHT,
  DESIGN_SAMPLE_DEV_CONSOLE_ENTRIES,
  DESIGN_SAMPLE_DEV_CONSOLE_PAUSED_STEPS,
  DESIGN_SAMPLE_MULTISIG_MAX_KEYS,
  DESIGN_SAMPLE_SCRIPT_HEX,
  DESIGN_SAMPLE_TX_HEX,
  type DesignFeatureId
} from '@/constants/designSystem'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { mainContainerPaddingHorizontalRatio } from '@/styles/layout'
import type { Utxo } from '@/types/models/Utxo'
import { emptyPin } from '@/utils/pin'

const tn = _tn('settings.developer.designSystem.features')

const CHART_HEIGHT_RATIO = 0.6
const DEV_CONSOLE_PREVIEW_HEIGHT = 320
const PREVIEW_LIST_LIMIT = 30
const NO_PAUSED_STEPS: string[] = []
const NO_INPUTS: Utxo[] = []
const MULTISIG_INITIAL_REQUIRED = 2
const MULTISIG_INITIAL_TOTAL = 3
const SEED_WORD_COUNT = 12
const WORD_LIST = 'english'

function NOOP() {
  // design preview only
}

const DEV_CONSOLE_PREVIEW_ACTIONS: DevConsolePanelActions = {
  onClear: NOOP,
  onClose: NOOP,
  onCopy: NOOP,
  onHide: NOOP,
  onNextStep: NOOP,
  onPause: NOOP,
  onResume: NOOP,
  onToggleDock: NOOP,
  onToggleSession: NOOP
}

type SetPreviewProps = {
  setIndex: number
}

function useContentSize() {
  const { width, height } = useWindowDimensions()
  return {
    chartHeight: height * CHART_HEIGHT_RATIO,
    contentWidth: width * (1 - 2 * mainContainerPaddingHorizontalRatio)
  }
}

function SankeyPreview({ setIndex }: SetPreviewProps) {
  const { chartHeight } = useContentSize()
  const sample = DESIGN_SANKEY_SETS[setIndex].data

  if (sample.chart === 'transaction') {
    return (
      <SSScrollView showsVerticalScrollIndicator={false}>
        <SSTransactionChart
          transaction={sample.transaction}
          ownAddresses={sample.ownAddresses}
          internalAddresses={sample.internalAddresses}
          ownedOutpoints={sample.ownedOutpoints}
        />
      </SSScrollView>
    )
  }

  return (
    <View style={{ height: chartHeight }}>
      <SSCurrentTransactionChart
        inputs={sample.inputs}
        outputs={sample.outputs}
        feeRate={sample.feeRate}
        ownAddresses={sample.ownAddresses}
      />
    </View>
  )
}

function TransactionChartPreview({ setIndex }: SetPreviewProps) {
  const sample = DESIGN_TRANSACTION_CHART_SETS[setIndex].data

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSTransactionChart
        transaction={sample.transaction}
        ownAddresses={sample.ownAddresses}
        internalAddresses={sample.internalAddresses}
      />
    </SSScrollView>
  )
}

function UtxoChartPreview({ setIndex }: SetPreviewProps) {
  const display = useDisplayPreferences()
  const { chartHeight, contentWidth } = useContentSize()
  const { utxos, total } = DESIGN_UTXO_SETS[setIndex].data
  const listed = utxos.slice(0, PREVIEW_LIST_LIMIT)

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSBubbleChart
          canvasSize={{ height: chartHeight, width: contentWidth }}
          utxos={utxos}
          inputs={NO_INPUTS}
          onPress={NOOP}
        />
        <SSSeparator />
        <SSDesignSection title={tn('utxoBars')}>
          <SSVStack gap="sm">
            {listed.map((utxo) => (
              <SSUtxoBar
                key={`bar-${utxo.txid}:${utxo.vout}`}
                utxoValue={utxo.value}
                totalBalance={total}
              />
            ))}
          </SSVStack>
          {listed.map((utxo, index) => (
            <SSUtxoCard
              key={`card-${utxo.txid}:${utxo.vout}`}
              {...display}
              utxo={utxo}
              totalBalance={total}
              addressIndex={index}
              onPress={NOOP}
              onToggleExcluded={NOOP}
            />
          ))}
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

function DecodedPreview() {
  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSDesignSection title={tn('decodedTransaction')}>
          <SSTransactionDecoded txHex={DESIGN_SAMPLE_TX_HEX} />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('decodedScript')}>
          <SSScriptDecoded script={DESIGN_SAMPLE_SCRIPT_HEX} />
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

function MultisigSelectorPreview() {
  const [required, setRequired] = useState(MULTISIG_INITIAL_REQUIRED)
  const [total, setTotal] = useState(MULTISIG_INITIAL_TOTAL)

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSMultisigCountSelector
          maxCount={DESIGN_SAMPLE_MULTISIG_MAX_KEYS}
          requiredNumber={required}
          totalNumber={total}
          viewOnly={false}
          onChangeRequiredNumber={setRequired}
          onChangeTotalNumber={setTotal}
        />
        <SSSeparator />
        <SSDesignSection title={tn('viewOnly')}>
          <SSMultisigCountSelector
            maxCount={DESIGN_SAMPLE_MULTISIG_MAX_KEYS}
            requiredNumber={required}
            totalNumber={total}
            viewOnly
          />
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

function SeedWordInputPreview() {
  return (
    <SSSeedWordsEntry
      wordCount={SEED_WORD_COUNT}
      wordListName={WORD_LIST}
      network={Network.Testnet}
      showChecksum
      showFingerprint
      showPassphrase
      autoCheckClipboard={false}
      showCancelButton={false}
    />
  )
}

type WordSuggestionStateProps = {
  title: string
  wordStart: string
}

const STATIC_WORD_SELECTOR_STYLE = {
  opacity: 1,
  position: 'relative' as const,
  zIndex: 0
}

function WordSuggestionState({ title, wordStart }: WordSuggestionStateProps) {
  return (
    <SSDesignSection title={title}>
      <SSText size="sm" color="muted">
        {wordStart}
      </SSText>
      <SSKeyboardWordSelector
        visible
        wordStart={wordStart}
        wordListName={WORD_LIST}
        onWordSelected={NOOP}
        style={STATIC_WORD_SELECTOR_STYLE}
      />
    </SSDesignSection>
  )
}

type TagStateProps = {
  title: string
  tags: string[]
  selected: number
}

function TagState({ title, tags, selected }: TagStateProps) {
  const [allTags, setAllTags] = useState(tags)
  const [selectedTags, setSelectedTags] = useState(tags.slice(0, selected))

  function handleAddTag(tag: string) {
    setAllTags((current) => [...current, tag])
    setSelectedTags((current) => [...current, tag])
  }

  function handleRemoveTag(tag: string) {
    setSelectedTags((current) => current.filter((item) => item !== tag))
  }

  return (
    <SSDesignSection title={title}>
      <SSTagInput
        tags={allTags}
        selectedTags={selectedTags}
        onAdd={handleAddTag}
        onSelect={setSelectedTags}
        onRemove={handleRemoveTag}
      />
    </SSDesignSection>
  )
}

function AutocompletePreview() {
  const [wordStart, setWordStart] = useState('')

  function handleWordSelected(word: string) {
    setWordStart(word)
  }

  return (
    <View style={styles.flex}>
      <SSScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.scrollContent}>
          <SSText uppercase>{tn('wordSuggestions')}</SSText>
          <SSDesignSection title={tn('wordsLive')}>
            <SSTextInput
              value={wordStart}
              placeholder={tn('typeToSuggest')}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setWordStart}
            />
          </SSDesignSection>
          {DESIGN_WORD_STATES.map((state) => (
            <WordSuggestionState
              key={state.title}
              title={tn(state.title)}
              wordStart={state.wordStart}
            />
          ))}
          <SSSeparator />
          <SSText uppercase>{tn('tagSuggestions')}</SSText>
          {DESIGN_TAG_STATES.map((state) => (
            <TagState
              key={state.title}
              title={tn(state.title)}
              tags={state.tags}
              selected={state.selected}
            />
          ))}
        </SSVStack>
      </SSScrollView>
      <SSKeyboardWordSelector
        visible={wordStart.length > 0}
        wordStart={wordStart}
        wordListName={WORD_LIST}
        onWordSelected={handleWordSelected}
      />
    </View>
  )
}

function LightningNodePreview({ setIndex }: SetPreviewProps) {
  const display = useDisplayPreferences()
  const { contentWidth } = useContentSize()
  const { rows, total } = DESIGN_CHANNEL_SETS[setIndex].data

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSLightningChannelsBubbleChart
          width={contentWidth}
          height={contentWidth}
          rows={rows}
          privacyMode={display.privacyMode}
          onChannelPress={NOOP}
        />
        <SSSeparator />
        <SSDesignSection title={tn('liquidity')}>
          <SSVStack gap="md">
            {rows.slice(0, PREVIEW_LIST_LIMIT).map((channel) => (
              <SSVStack key={channel.chanId} gap="xs">
                <SSHStack justifyBetween>
                  <SSText size="sm">{channel.peerLabel}</SSText>
                  <SSStyledSatText
                    amount={channel.localSats + channel.remoteSats}
                    textSize="sm"
                  />
                </SSHStack>
                <SSLightningChannelLiquidityBar
                  channelCapacity={channel.localSats + channel.remoteSats}
                  localSats={channel.localSats}
                  remoteSats={channel.remoteSats}
                  nodeTotalCapacity={total}
                  privacyMode={display.privacyMode}
                />
              </SSVStack>
            ))}
          </SSVStack>
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

function TransactionCardPreview() {
  const display = useDisplayPreferences()
  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        {DESIGN_TRANSACTION_CARD_STATES.map((state) => (
          <SSDesignSection
            key={`${state.title}-${state.count ?? ''}`}
            title={tn(state.title, { count: state.count })}
          >
            <SSTransactionCard
              {...display}
              transaction={state.transaction}
              blockHeight={DESIGN_SAMPLE_BLOCK_HEIGHT}
              walletBalance={state.walletBalance}
              expand={state.expand}
              onPress={NOOP}
              onOpenFiatSettings={NOOP}
            />
          </SSDesignSection>
        ))}
      </SSVStack>
    </SSScrollView>
  )
}

function HistoryChartPreview({ setIndex }: SetPreviewProps) {
  const { chartHeight } = useContentSize()
  const { transactions, utxos } = DESIGN_HISTORY_SETS[setIndex].data

  return (
    <View style={{ height: chartHeight }}>
      <SSHistoryChart
        transactions={transactions}
        utxos={utxos}
        blockchainHeight={DESIGN_SAMPLE_BLOCK_HEIGHT}
        onOpenUtxo={NOOP}
        onOpenTransaction={NOOP}
      />
    </View>
  )
}

function DevConsolePreview({ setIndex }: SetPreviewProps) {
  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSDesignSection title={tn('devConsoleRunning')}>
          <SSDevConsolePanel
            actions={DEV_CONSOLE_PREVIEW_ACTIONS}
            dock="top"
            entries={DESIGN_LOG_SETS[setIndex].data}
            pausedSteps={NO_PAUSED_STEPS}
            showPrevious={false}
            stepMode={false}
            style={styles.devConsole}
          />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('devConsolePaused')}>
          <SSDevConsolePanel
            actions={DEV_CONSOLE_PREVIEW_ACTIONS}
            dock="top"
            entries={DESIGN_SAMPLE_DEV_CONSOLE_ENTRIES.slice(0, 2)}
            pausedSteps={DESIGN_SAMPLE_DEV_CONSOLE_PAUSED_STEPS}
            showPrevious={false}
            stepMode
            style={styles.devConsole}
          />
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

function PinInputPreview() {
  const [pin, setPin] = useState(() => emptyPin(PIN_SIZE))

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSDesignSection title={tn('pinEntry')}>
          <SSPinInput pin={pin} setPin={setPin} />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('keypadSetPin')}>
          <SSKeyboard withClear={false} onPress={NOOP} onDelete={NOOP} />
        </SSDesignSection>
        <SSSeparator />
        <SSDesignSection title={tn('keypadShuffled')}>
          <SSKeyboard random onPress={NOOP} onDelete={NOOP} onClear={NOOP} />
        </SSDesignSection>
      </SSVStack>
    </SSScrollView>
  )
}

const FEATURE_PREVIEWS: Record<
  DesignFeatureId,
  (props: SetPreviewProps) => React.ReactNode
> = {
  autocomplete: AutocompletePreview,
  decoded: DecodedPreview,
  devConsole: DevConsolePreview,
  historyChart: HistoryChartPreview,
  lightningNode: LightningNodePreview,
  multisigSelector: MultisigSelectorPreview,
  pinInput: PinInputPreview,
  sankey: SankeyPreview,
  seedWordInput: SeedWordInputPreview,
  transactionCard: TransactionCardPreview,
  transactionChart: TransactionChartPreview,
  utxoChart: UtxoChartPreview
}

type SetStatusProps = {
  names: DesignSampleSetName[]
  setIndex: number
}

function SetStatus({ names, setIndex }: SetStatusProps) {
  return (
    <SSText size="xs" color="muted" uppercase style={styles.status}>
      {tn('setStatus', {
        count: names.length,
        index: setIndex + 1,
        name: tn(DESIGN_SAMPLE_SET_LABEL_KEYS[names[setIndex]])
      })}
    </SSText>
  )
}

type SSDesignFeaturePreviewProps = {
  feature: DesignFeatureId
  setIndex: number
}

function SSDesignFeaturePreview({
  feature,
  setIndex
}: SSDesignFeaturePreviewProps) {
  const Preview = FEATURE_PREVIEWS[feature]
  const names = DESIGN_FEATURE_SET_NAMES[feature]

  if (!names) {
    return <Preview setIndex={0} />
  }

  return (
    <View style={styles.flex}>
      <SetStatus names={names} setIndex={setIndex} />
      <Preview setIndex={setIndex} />
    </View>
  )
}

const styles = StyleSheet.create({
  devConsole: {
    height: DEV_CONSOLE_PREVIEW_HEIGHT
  },
  flex: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 64
  },
  status: {
    paddingBottom: 12
  }
})

export default SSDesignFeaturePreview
