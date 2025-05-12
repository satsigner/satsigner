import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { TxDecoded, type TxDecodedField, TxField } from '@/utils/txDecoded'

import { SSIconChevronDown, SSIconChevronUp } from './icons'
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

  function toggleDisplay() {
    setDisplay(display === 'list' ? 'bytes' : 'list')
  }

  return (
    <>
      <TouchableOpacity onPress={toggleDisplay}>
        <SSHStack
          gap="sm"
          style={{
            justifyContent: 'flex-end'
          }}
        >
          <SSText color="muted">
            {display === 'list' ? tn('btnCollapse') : tn('btnExpand')}
          </SSText>
          {display === 'list' ? (
            <SSIconChevronUp height={5} width={12} />
          ) : (
            <SSIconChevronDown height={5} width={12} />
          )}
        </SSHStack>
      </TouchableOpacity>
      {display === 'bytes' ? (
        <SSTransactionDecodedBytes decoded={decoded} />
      ) : (
        <SSTransactionDecodedList decoded={decoded} />
      )}
    </>
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
          disabled={textSize === TEXT_SIZES[TEXT_SIZES.length - 1]}
          style={[
            styles.zoomButton,
            {
              opacity: textSize === TEXT_SIZES[TEXT_SIZES.length - 1] ? 0.5 : 1
            }
          ]}
        >
          <SSText size="xl" style={styles.zoomText}>
            +
          </SSText>
        </TouchableOpacity>
      </SSHStack>
      <SSHStack style={styles.bytesContainer} gap="none">
        {decoded.map((item, i) => {
          return (
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
                              padding: 2.6,
                              marginBottom: -1
                            }
                          : {
                              color: colors[item.field as TxField],
                              padding: 2.6,
                              marginBottom: -1
                            }
                      }
                    >
                      {byte}
                    </SSText>
                  </TouchableOpacity>
                )
              })}
            </Fragment>
          )
        })}
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
      <SSText color="muted">{value}</SSText>
      <SSText color="muted" size="xxs">
        {tn(`description.${field}`, { ...placeholders })}
      </SSText>
      <SSText type="mono">{value}</SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  bytesContainer: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    alignContent: 'center',
    width: 'auto',
    justifyContent: 'flex-start',
    marginLeft: 'auto'
  },
  selectedItemContainer: {
    marginTop: 10
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

export default SSTransactionDecoded
