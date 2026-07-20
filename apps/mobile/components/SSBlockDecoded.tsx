import { Fragment, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import {
  type BlockDecodedField,
  BlockField,
  isBlockField
} from '@/utils/blockDecoded'
import { TxField } from '@/utils/txDecoded'

const tnBlock = _tn('explorer.block.decoded')
const tnTx = _tn('transaction.decoded')

const TEXT_SIZES = ['xxs', 'xs', 'sm', 'md'] as const
type TextSize = (typeof TEXT_SIZES)[number]

const BLOCK_COLORS: Record<BlockField, string> = {
  [BlockField.Version]: '#ffffff',
  [BlockField.PrevHash]: '#4A90D9',
  [BlockField.MerkleRoot]: '#9B59B6',
  [BlockField.Timestamp]: '#F39C12',
  [BlockField.Bits]: '#1ABC9C',
  [BlockField.Nonce]: '#E67E22',
  [BlockField.TxCount]: '#aaaaaa'
}

const TX_COLORS: Record<TxField, string> = {
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

const BYTE_BASE_STYLE = {
  marginBottom: -1,
  padding: 2.6
} as const

function byteChunks(hex: string) {
  const chunks: string[] = []
  for (let i = 0; i + 1 < hex.length; i += 2) {
    chunks.push(hex.slice(i, i + 2))
  }
  return chunks
}

function fieldColor(field: BlockDecodedField['field']): string {
  if (isBlockField(field)) {
    return BLOCK_COLORS[field]
  }
  return TX_COLORS[field] ?? Colors.white
}

type SSBlockDecodedProps = {
  fields: BlockDecodedField[]
}

export default function SSBlockDecoded({ fields }: SSBlockDecodedProps) {
  const [selectedItem, setSelectedItem] = useState(0)
  const [textSize, setTextSize] = useState<TextSize>('xxs')

  function handleZoomIn() {
    const currentIndex = TEXT_SIZES.indexOf(textSize)
    if (currentIndex < TEXT_SIZES.length - 1) {
      setTextSize(TEXT_SIZES[currentIndex + 1])
    }
  }

  function handleZoomOut() {
    const currentIndex = TEXT_SIZES.indexOf(textSize)
    if (currentIndex > 0) {
      setTextSize(TEXT_SIZES[currentIndex - 1])
    }
  }

  function selectField(index: number) {
    setSelectedItem((current) => (current === index ? -1 : index))
  }

  const selected = selectedItem >= 0 ? fields[selectedItem] : undefined

  return (
    <SSVStack gap="none">
      <SSHStack gap="none" style={styles.zoomContainer}>
        <Pressable
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
        </Pressable>
        <Pressable
          onPress={handleZoomIn}
          disabled={textSize === TEXT_SIZES.at(-1)}
          style={[
            styles.zoomButton,
            { opacity: textSize === TEXT_SIZES.at(-1) ? 0.5 : 1 }
          ]}
        >
          <SSText size="xl" style={styles.zoomText}>
            +
          </SSText>
        </Pressable>
      </SSHStack>
      <SSHStack style={styles.bytesContainer} gap="none">
        {fields.map((item, i) => (
          <Fragment key={`field-${i}-${item.field}`}>
            {byteChunks(item.hex).map((byte, j) => {
              const isSelected = selectedItem === i
              return (
                <Pressable
                  key={`field-${i}-byte-${j}-${byte}`}
                  onPress={() => selectField(i)}
                >
                  <SSText
                    type="mono"
                    size={textSize}
                    style={
                      isSelected
                        ? styles.byteSelected
                        : {
                            ...BYTE_BASE_STYLE,
                            color: fieldColor(item.field)
                          }
                    }
                  >
                    {byte}
                  </SSText>
                </Pressable>
              )
            })}
          </Fragment>
        ))}
      </SSHStack>
      <View style={styles.selectedItemContainer}>
        {selected ? <BlockDecodedItem {...selected} /> : null}
      </View>
    </SSVStack>
  )
}

function BlockDecodedItem({ field, value, placeholders }: BlockDecodedField) {
  const isBlock = isBlockField(field)
  const label = isBlock
    ? tnBlock(`label.${field}`, { ...placeholders })
    : tnTx(`label.${field}`, { ...placeholders })
  const description = isBlock
    ? tnBlock(`description.${field}`, { ...placeholders })
    : tnTx(`description.${field}`, { ...placeholders })
  const txIndex = placeholders?.tx

  return (
    <SSVStack gap="none">
      {typeof txIndex === 'number' ? (
        <SSText color="muted" size="xxs">
          {tnBlock('txPrefix', { tx: txIndex })}
        </SSText>
      ) : null}
      <SSText weight="bold">{label}</SSText>
      <SSText type="mono">{value}</SSText>
      <SSText color="muted" size="xxs">
        {description}
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  byteSelected: {
    ...BYTE_BASE_STYLE,
    backgroundColor: 'white',
    color: 'black'
  },
  bytesContainer: {
    flexWrap: 'wrap',
    rowGap: 0
  },
  selectedItemContainer: {
    marginTop: 12,
    minHeight: 72
  },
  zoomButton: {
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  zoomContainer: {
    justifyContent: 'flex-end',
    marginBottom: 4
  },
  zoomText: {
    color: Colors.white
  }
})
