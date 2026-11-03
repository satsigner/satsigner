import { useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Network } from 'react-native-bdk-sdk'

import SSBubbleChart from '@/components/SSBubbleChart'
import SSCurrentTransactionChart from '@/components/SSCurrentTransactionChart'
import SSDesignSection from '@/components/SSDesignSection'
import SSHistoryChart from '@/components/SSHistoryChart'
import SSKeyboardWordSelector from '@/components/SSKeyboardWordSelector'
import SSLightningChannelLiquidityBar from '@/components/SSLightningChannelLiquidityBar'
import SSLightningChannelsBubbleChart from '@/components/SSLightningChannelsBubbleChart'
import SSMultisigCountSelector from '@/components/SSMultisigCountSelector'
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
import {
  DESIGN_SAMPLE_BLOCK_HEIGHT,
  DESIGN_SAMPLE_FEE_RATE,
  DESIGN_SAMPLE_LIGHTNING_CHANNELS,
  DESIGN_SAMPLE_MULTISIG_MAX_KEYS,
  DESIGN_SAMPLE_OWN_ADDRESSES,
  DESIGN_SAMPLE_SANKEY_OUTPUTS,
  DESIGN_SAMPLE_SCRIPT_HEX,
  DESIGN_SAMPLE_TAGS,
  DESIGN_SAMPLE_TRANSACTIONS,
  DESIGN_SAMPLE_TX_HEX,
  DESIGN_SAMPLE_UTXOS,
  type DesignFeatureId
} from '@/constants/designSystem'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { mainContainerPaddingHorizontalRatio } from '@/styles/layout'
import { getTransactionRunningBalances } from '@/utils/walletOwnership'

const tn = _tn('settings.developer.designSystem.features')

const CHART_HEIGHT_RATIO = 0.6
const MULTISIG_INITIAL_REQUIRED = 2
const MULTISIG_INITIAL_TOTAL = 3
const SEED_WORD_COUNT = 12
const WORD_LIST = 'english'
const SANKEY_INPUTS = new Map(
  DESIGN_SAMPLE_UTXOS.slice(0, 2).map((utxo) => [
    `${utxo.txid}:${utxo.vout}`,
    utxo
  ])
)
const SPEND_TRANSACTION = DESIGN_SAMPLE_TRANSACTIONS.find(
  (transaction) => transaction.type === 'send'
)
const INTERNAL_ADDRESSES = new Set(
  DESIGN_SAMPLE_UTXOS.filter((utxo) => utxo.keychain === 'internal').flatMap(
    (utxo) => (utxo.addressTo ? [utxo.addressTo] : [])
  )
)
const UTXO_TOTAL = DESIGN_SAMPLE_UTXOS.reduce(
  (total, utxo) => total + utxo.value,
  0
)
const LIGHTNING_TOTAL = DESIGN_SAMPLE_LIGHTNING_CHANNELS.reduce(
  (total, channel) => total + channel.localSats + channel.remoteSats,
  0
)
const RUNNING_BALANCES = getTransactionRunningBalances(
  DESIGN_SAMPLE_TRANSACTIONS
)
const TRANSACTIONS_NEWEST_FIRST = DESIGN_SAMPLE_TRANSACTIONS.toReversed()

function NOOP() {
  // design preview only
}

function useContentSize() {
  const { width, height } = useWindowDimensions()
  return {
    chartHeight: height * CHART_HEIGHT_RATIO,
    contentWidth: width * (1 - 2 * mainContainerPaddingHorizontalRatio)
  }
}

function SankeyPreview() {
  const { chartHeight } = useContentSize()

  return (
    <View style={{ height: chartHeight }}>
      <SSCurrentTransactionChart
        inputs={SANKEY_INPUTS}
        outputs={DESIGN_SAMPLE_SANKEY_OUTPUTS}
        feeRate={DESIGN_SAMPLE_FEE_RATE}
        ownAddresses={DESIGN_SAMPLE_OWN_ADDRESSES}
      />
    </View>
  )
}

function TransactionChartPreview() {
  if (!SPEND_TRANSACTION) {
    return null
  }

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSTransactionChart
        transaction={SPEND_TRANSACTION}
        ownAddresses={DESIGN_SAMPLE_OWN_ADDRESSES}
        internalAddresses={INTERNAL_ADDRESSES}
      />
    </SSScrollView>
  )
}

function UtxoChartPreview() {
  const display = useDisplayPreferences()
  const { chartHeight, contentWidth } = useContentSize()

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSBubbleChart
          canvasSize={{ height: chartHeight, width: contentWidth }}
          utxos={DESIGN_SAMPLE_UTXOS}
          inputs={[]}
          onPress={NOOP}
        />
        <SSSeparator />
        <SSDesignSection title={tn('utxoBars')}>
          <SSVStack gap="sm">
            {DESIGN_SAMPLE_UTXOS.map((utxo) => (
              <SSUtxoBar
                key={`bar-${utxo.txid}:${utxo.vout}`}
                utxoValue={utxo.value}
                totalBalance={UTXO_TOTAL}
              />
            ))}
          </SSVStack>
          {DESIGN_SAMPLE_UTXOS.map((utxo, index) => (
            <SSUtxoCard
              key={`card-${utxo.txid}:${utxo.vout}`}
              {...display}
              utxo={utxo}
              totalBalance={UTXO_TOTAL}
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

function AutocompletePreview() {
  const [wordStart, setWordStart] = useState('')
  const [tags, setTags] = useState(DESIGN_SAMPLE_TAGS)
  const [selectedTags, setSelectedTags] = useState(
    DESIGN_SAMPLE_TAGS.slice(0, 1)
  )

  function handleWordSelected(word: string) {
    setWordStart(word)
  }

  function handleAddTag(tag: string) {
    setTags((current) => [...current, tag])
    setSelectedTags((current) => [...current, tag])
  }

  function handleRemoveTag(tag: string) {
    setSelectedTags((current) => current.filter((item) => item !== tag))
  }

  return (
    <View style={styles.flex}>
      <SSScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.scrollContent}>
          <SSDesignSection title={tn('wordSuggestions')}>
            <SSTextInput
              value={wordStart}
              placeholder={tn('typeToSuggest')}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setWordStart}
            />
          </SSDesignSection>
          <SSSeparator />
          <SSDesignSection title={tn('tagSuggestions')}>
            <SSTagInput
              tags={tags}
              selectedTags={selectedTags}
              onAdd={handleAddTag}
              onSelect={setSelectedTags}
              onRemove={handleRemoveTag}
            />
          </SSDesignSection>
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

function LightningNodePreview() {
  const display = useDisplayPreferences()
  const { contentWidth } = useContentSize()

  return (
    <SSScrollView showsVerticalScrollIndicator={false}>
      <SSVStack gap="lg" style={styles.scrollContent}>
        <SSLightningChannelsBubbleChart
          width={contentWidth}
          height={contentWidth}
          rows={DESIGN_SAMPLE_LIGHTNING_CHANNELS}
          privacyMode={display.privacyMode}
          onChannelPress={NOOP}
        />
        <SSSeparator />
        <SSDesignSection title={tn('liquidity')}>
          <SSVStack gap="md">
            {DESIGN_SAMPLE_LIGHTNING_CHANNELS.map((channel) => (
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
                  nodeTotalCapacity={LIGHTNING_TOTAL}
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
        {[false, true].map((expand) => (
          <SSDesignSection
            key={String(expand)}
            title={expand ? tn('expanded') : tn('collapsed')}
          >
            <SSVStack gap="none">
              {TRANSACTIONS_NEWEST_FIRST.map((transaction) => (
                <SSTransactionCard
                  key={transaction.id}
                  {...display}
                  transaction={transaction}
                  blockHeight={DESIGN_SAMPLE_BLOCK_HEIGHT}
                  walletBalance={RUNNING_BALANCES.get(transaction.id)}
                  expand={expand}
                  onPress={NOOP}
                  onOpenFiatSettings={NOOP}
                />
              ))}
            </SSVStack>
          </SSDesignSection>
        ))}
      </SSVStack>
    </SSScrollView>
  )
}

function HistoryChartPreview() {
  const { chartHeight } = useContentSize()

  return (
    <View style={{ height: chartHeight }}>
      <SSHistoryChart
        transactions={DESIGN_SAMPLE_TRANSACTIONS}
        utxos={DESIGN_SAMPLE_UTXOS}
        blockchainHeight={DESIGN_SAMPLE_BLOCK_HEIGHT}
        onOpenUtxo={NOOP}
        onOpenTransaction={NOOP}
      />
    </View>
  )
}

const FEATURE_PREVIEWS: Record<DesignFeatureId, () => React.ReactNode> = {
  autocomplete: AutocompletePreview,
  decoded: DecodedPreview,
  historyChart: HistoryChartPreview,
  lightningNode: LightningNodePreview,
  multisigSelector: MultisigSelectorPreview,
  sankey: SankeyPreview,
  seedWordInput: SeedWordInputPreview,
  transactionCard: TransactionCardPreview,
  transactionChart: TransactionChartPreview,
  utxoChart: UtxoChartPreview
}

type SSDesignFeaturePreviewProps = {
  feature: DesignFeatureId
}

function SSDesignFeaturePreview({ feature }: SSDesignFeaturePreviewProps) {
  const Preview = FEATURE_PREVIEWS[feature]
  return <Preview />
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 64
  }
})

export default SSDesignFeaturePreview
