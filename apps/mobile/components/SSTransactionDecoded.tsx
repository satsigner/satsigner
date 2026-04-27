import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { Colors, Layout, Typography } from '@/styles'
import { TxDecoded, type TxDecodedField, TxField } from '@/utils/txDecoded'

import SSPerformanceWarning from './SSPerformanceWarning'
import SSText from './SSText'

const tn = _tn('transaction.decoded')
const TEXT_SIZES = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl'] as const
type TextSize = (typeof TEXT_SIZES)[number]

function byteChunks(hex: string) {
  const chunk = []
  for (let i = 0; i < hex.length; i += 2) {
    chunk.push([hex[i] + hex[i + 1]])
  }
  return chunk
}

function hexToAsciiFromHex(hex: string) {
  const normalized = hex.replace(/^0x/i, '').replace(/\s/g, '')
  let out = ''
  for (let i = 0; i + 1 < normalized.length; i += 2) {
    const n = parseInt(normalized.slice(i, i + 2), 16)
    if (Number.isNaN(n)) {
      out += '?'
      continue
    }
    out += n >= 32 && n <= 126 ? String.fromCharCode(n) : '.'
  }
  if (normalized.length % 2 === 1) {
    out += '?'
  }
  return out
}

type FormatChipProps = {
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}

function FormatChip({ label, active, disabled, onPress }: FormatChipProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.formatChip,
        active && styles.formatChipActive,
        disabled && styles.formatChipDisabled
      ]}
    >
      <SSText
        color={active ? 'white' : 'muted'}
        size="xxs"
        weight={active ? 'medium' : 'regular'}
      >
        {label}
      </SSText>
    </TouchableOpacity>
  )
}

type TransactionFormatToolbarProps =
  | {
      ascii: boolean
      onAscii: (ascii: boolean) => void
      scope: 'encodingOnly'
    }
  | {
      ascii: boolean
      decodedLayout: 'list' | 'bytes'
      onAscii: (ascii: boolean) => void
      onDecodedLayout: (layout: 'list' | 'bytes') => void
      onRawOpen: (open: boolean) => void
      rawOpen: boolean
      scope: 'full'
    }

function TransactionFormatToolbar(props: TransactionFormatToolbarProps) {
  if (props.scope === 'encodingOnly') {
    return (
      <SSHStack gap="md" style={styles.formatToolbar}>
        <SSHStack gap="xs" style={styles.formatChipGroup}>
          <FormatChip
            active={!props.ascii}
            label={tn('toolbar.hex')}
            onPress={() => props.onAscii(false)}
          />
          <FormatChip
            active={props.ascii}
            label={tn('toolbar.ascii')}
            onPress={() => props.onAscii(true)}
          />
        </SSHStack>
      </SSHStack>
    )
  }

  const encodingDisabled = !props.rawOpen

  return (
    <SSHStack gap="md" style={[styles.formatToolbar, styles.formatToolbarFull]}>
      <SSHStack gap="xs" style={styles.formatChipGroup}>
        <FormatChip
          active={!props.rawOpen && props.decodedLayout === 'list'}
          disabled={props.rawOpen}
          label={tn('toolbar.list')}
          onPress={() => {
            props.onRawOpen(false)
            props.onDecodedLayout('list')
          }}
        />
        <FormatChip
          active={!props.rawOpen && props.decodedLayout === 'bytes'}
          disabled={props.rawOpen}
          label={tn('toolbar.bytes')}
          onPress={() => {
            props.onRawOpen(false)
            props.onDecodedLayout('bytes')
          }}
        />
      </SSHStack>
      <View style={styles.toolbarSep} />
      <SSHStack gap="xs" style={styles.formatChipGroup}>
        <FormatChip
          active={!props.rawOpen}
          label={tn('toolbar.decoded')}
          onPress={() => props.onRawOpen(false)}
        />
        <FormatChip
          active={props.rawOpen}
          label={tn('toolbar.raw')}
          onPress={() => props.onRawOpen(true)}
        />
      </SSHStack>
      <View style={styles.toolbarSep} />
      <SSHStack gap="xs" style={styles.formatChipGroup}>
        <FormatChip
          active={!props.ascii}
          disabled={encodingDisabled}
          label={tn('toolbar.hex')}
          onPress={() => props.onAscii(false)}
        />
        <FormatChip
          active={props.ascii}
          disabled={encodingDisabled}
          label={tn('toolbar.ascii')}
          onPress={() => props.onAscii(true)}
        />
      </SSHStack>
    </SSHStack>
  )
}

type SSTransactionRawPayloadProps = {
  ascii: boolean
  txHex: string
}

function SSTransactionRawPayload({
  ascii,
  txHex
}: SSTransactionRawPayloadProps) {
  const displayValue = useMemo(
    () => (ascii ? hexToAsciiFromHex(txHex) : txHex),
    [ascii, txHex]
  )

  return (
    <TextInput
      editable={false}
      multiline
      scrollEnabled
      showSoftInputOnFocus={false}
      style={styles.hexField}
      value={displayValue}
    />
  )
}

function SSTransactionHexOnly({ txHex }: { txHex: string }) {
  const [ascii, setAscii] = useState(false)

  return (
    <SSVStack gap="sm">
      <TransactionFormatToolbar
        ascii={ascii}
        onAscii={setAscii}
        scope="encodingOnly"
      />
      <SSTransactionRawPayload ascii={ascii} txHex={txHex} />
    </SSVStack>
  )
}

type SSTransactionDecodedProps = {
  txHex: string
  defaultDisplay?: 'list' | 'bytes'
}

function SSTransactionDecoded({
  txHex,
  defaultDisplay = 'bytes'
}: SSTransactionDecodedProps) {
  const decoded = useMemo(() => TxDecoded.decodeFromHex(txHex), [txHex])
  const [display, setDisplay] = useState<'list' | 'bytes'>(defaultDisplay)
  const [rawFieldOpen, setRawFieldOpen] = useState(false)
  const [rawAscii, setRawAscii] = useState(false)

  function setRawOpen(open: boolean) {
    setRawFieldOpen(open)
    if (open) {
      setRawAscii(false)
    }
  }

  return (
    <SSVStack gap="sm">
      <TransactionFormatToolbar
        ascii={rawAscii}
        decodedLayout={display}
        onAscii={setRawAscii}
        onDecodedLayout={setDisplay}
        onRawOpen={setRawOpen}
        rawOpen={rawFieldOpen}
        scope="full"
      />
      {rawFieldOpen ? (
        <SSTransactionRawPayload ascii={rawAscii} txHex={txHex} />
      ) : display === 'bytes' ? (
        <SSTransactionDecodedBytes decoded={decoded} />
      ) : (
        <SSTransactionDecodedList decoded={decoded} />
      )}
    </SSVStack>
  )
}

type SSTransactionDecodedDisplayProps = {
  decoded: TxDecodedField[]
}

function SSTransactionDecodedBytes({
  decoded
}: SSTransactionDecodedDisplayProps) {
  const [selectedItem, setSelectedItem] = useState(0)
  const [textSize, setTextSize] = useState<TextSize>('xs')

  const handleZoomIn = () => {
    const currentIndex = TEXT_SIZES.indexOf(textSize)
    if (currentIndex < TEXT_SIZES.length - 1) {
      setTextSize(TEXT_SIZES[currentIndex + 1])
    }
  }

  const handleZoomOut = () => {
    const currentIndex = TEXT_SIZES.indexOf(textSize)
    if (currentIndex > 0) {
      setTextSize(TEXT_SIZES[currentIndex - 1])
    }
  }

  const colors: Record<TxField, string> = {
    [TxField.Version]: '#fff',
    [TxField.Marker]: '#888',
    [TxField.Flag]: '#fff',
    [TxField.TxInVarInt]: '#888',
    [TxField.TxInHash]: '#E01919',
    [TxField.TxInIndex]: '#860B0B',
    [TxField.TxInScriptVarInt]: '#DD9595',
    [TxField.TxInScript]: '#860B0B',
    [TxField.TxInSequence]: '#860B0B',
    [TxField.TxOutVarInt]: '#aaa',
    [TxField.TxOutValue]: '#07BC03',
    [TxField.TxOutScriptVarInt]: '#93CC92',
    [TxField.TxOutScript]: '#C13939',
    [TxField.WitnessVarInt]: '#fff',
    [TxField.WitnessItemsVarInt]: '#888',
    [TxField.WitnessItem]: '#555',
    [TxField.WitnessItemEmpty]: '#694040',
    [TxField.WitnessItemPubkey]: '#C13939',
    [TxField.WitnessItemSignature]: '#8F5252',
    [TxField.WitnessItemScript]: '#694040',
    [TxField.Locktime]: '#eee',
    [TxField.TxOutScriptStandard]: '#608A64',
    [TxField.TxOutScriptNonStandard]: '#608A64'
  }

  return (
    <SSVStack gap="none">
      <SSHStack gap="none" style={styles.zoomContainer}>
        <TouchableOpacity
          onPress={handleZoomOut}
          disabled={textSize === TEXT_SIZES[0]}
          style={[
            styles.zoomButton,
            { opacity: textSize === TEXT_SIZES[0] ? 0.5 : 1 }
          ]}
        >
          <SSText size="xl" style={styles.zoomText}>
            -
          </SSText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleZoomIn}
          disabled={textSize === TEXT_SIZES.at(-1)}
          style={[
            styles.zoomButton,
            {
              opacity: textSize === TEXT_SIZES.at(-1) ? 0.5 : 1
            }
          ]}
        >
          <SSText size="xl" style={styles.zoomText}>
            +
          </SSText>
        </TouchableOpacity>
      </SSHStack>
      <SSHStack style={styles.bytesContainer} gap="none">
        {decoded.map((item, i) => (
          <Fragment key={i}>
            {byteChunks(item.hex).map((byte, j) => {
              const selected = selectedItem === i
              return (
                <TouchableOpacity
                  key={`${i}_${j}`}
                  onPress={() => setSelectedItem(selectedItem === i ? -1 : i)}
                >
                  <SSText
                    type="mono"
                    size={textSize}
                    style={
                      selected
                        ? {
                            backgroundColor: 'white',
                            color: 'black',
                            marginBottom: -1,
                            padding: 2.6
                          }
                        : {
                            color: colors[item.field as TxField],
                            marginBottom: -1,
                            padding: 2.6
                          }
                    }
                  >
                    {byte}
                  </SSText>
                </TouchableOpacity>
              )
            })}
          </Fragment>
        ))}
      </SSHStack>
      <View style={styles.selectedItemContainer}>
        {selectedItem !== -1 && (
          <SSTransactionDecodedItem {...decoded[selectedItem]} />
        )}
      </View>
    </SSVStack>
  )
}

function SSTransactionDecodedList({
  decoded
}: SSTransactionDecodedDisplayProps) {
  return (
    <SSVStack>
      {decoded.map((item, index) => (
        <SSTransactionDecodedItem {...item} key={index} />
      ))}
    </SSVStack>
  )
}

function SSTransactionDecodedItem({
  field,
  value,
  placeholders
}: TxDecodedField) {
  return (
    <SSVStack gap="none">
      <SSText weight="bold">{tn(`label.${field}`, { ...placeholders })}</SSText>
      <SSText type="mono">{value}</SSText>
      <SSText color="muted" size="xxs">
        {tn(`description.${field}`, { ...placeholders })}
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  bytesContainer: {
    alignContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginLeft: 'auto',
    width: 'auto'
  },
  formatChip: {
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  formatChipActive: {
    backgroundColor: Colors.gray[600]
  },
  formatChipDisabled: {
    opacity: 0.35
  },
  formatChipGroup: {
    alignItems: 'center',
    flexDirection: 'row'
  },
  formatToolbar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  formatToolbarFull: {
    marginTop: Layout.vStack.gap.md
  },
  hexField: {
    color: Colors.white,
    fontFamily: Typography.sfProMono,
    fontSize: 12,
    minHeight: 120,
    padding: 0,
    textAlignVertical: 'top'
  },
  selectedItemContainer: {
    marginTop: 10
  },
  toolbarSep: {
    backgroundColor: Colors.gray[700],
    height: 16,
    width: 1
  },
  zoomButton: {
    padding: 5
  },
  zoomContainer: {
    justifyContent: 'flex-end'
  },
  zoomText: {
    lineHeight: 14
  }
})

const thresholdCheck = ({ txHex }: SSTransactionDecodedProps) =>
  txHex.length > 2048

function SSTransactionDecodedWithWarning(props: SSTransactionDecodedProps) {
  const [dismissed, setDismissed] = useState(false)
  const [showRawHex, setShowRawHex] = useState(false)
  const [loadingRawHex, setLoadingRawHex] = useState(false)

  function handleLoadRawHex() {
    if (loadingRawHex) {
      return
    }

    setLoadingRawHex(true)
    requestAnimationFrame(() => setShowRawHex(true))
  }

  if (!dismissed && !showRawHex && thresholdCheck(props)) {
    return (
      <SSPerformanceWarning
        onDismiss={() => setDismissed(true)}
        onSecondaryAction={handleLoadRawHex}
        secondaryActionLoading={loadingRawHex}
        secondaryActionLabel={tn('btnLoadHex')}
        text={tn('warning')}
      />
    )
  }

  if (showRawHex) {
    return <SSTransactionHexOnly txHex={props.txHex} />
  }

  return <SSTransactionDecoded {...props} />
}

export default SSTransactionDecodedWithWarning
