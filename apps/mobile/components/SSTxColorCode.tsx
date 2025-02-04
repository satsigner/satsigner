import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { TxDecoded, TxDecodedField, TxField } from '@/utils/txDecoded'

import SSText from './SSText'

type SSTxColorCodeProps = {
  txHex: string
}

const colors: Record<TxField, string> = {
  [TxField.Version]: '#6f7',
  [TxField.Marker]: '#d21',
  [TxField.Flag]: '#0ad',
  [TxField.TxInVarInt]: '#0ed',
  [TxField.TxInHash]: '#e88',
  [TxField.TxInIndex]: '#8e8',
  [TxField.TxInScriptVarInt]: '#88e',
  [TxField.TxInScript]: '#ee8',
  [TxField.TxInSequence]: '#8ee',
  [TxField.TxOutVarInt]: '#e8e',
  [TxField.TxOutValue]: '#dd5',
  [TxField.TxOutScriptVarInt]: '#5dd',
  [TxField.TxOutScript]: '#d5d',
  [TxField.WitnessVarInt]: '#55e',
  [TxField.WitnessItemsVarInt]: '#d55',
  [TxField.WitnessItem]: '#5d5',
  [TxField.WitnessItemEmpty]: '#5e1',
  [TxField.WitnessItemPubkey]: '#db1',
  [TxField.WitnessItemSignature]: '#8e1',
  [TxField.WitnessItemScript]: '#836',
  [TxField.Locktime]: '#d23',
  [TxField.TxOutScriptStandard]: '#3ad',
  [TxField.TxOutScriptNonStandard]: '#536'
}

function replacePlaceholders(text: string, placeholders: (string | number)[]) {
  let result = text
  for (const item of placeholders) {
    result = result.replace(/(%d|%s)/, '' + item)
  }
  return result
}

function byteChunks(hex: string) {
  const chunk = []
  for (let i = 0; i < hex.length; i += 2) {
    chunk.push([hex[i] + hex[i + 1]])
  }
  return chunk
}

export default function SSTxColorCode({ txHex }: SSTxColorCodeProps) {
  const decoded = useMemo(() => TxDecoded.decodeFromHex(txHex), [txHex])
  const [selectedItem, setSelectedItem] = useState(0)

  return (
    <SSVStack gap="md">
      <SSHStack style={{ flexWrap: 'wrap' }} gap="none">
        {decoded.map((item, i) => {
          return (
            <Fragment key={i}>
              {byteChunks(item.hex).map((byte, j) => {
                const selected = selectedItem === i
                return (
                  <TouchableOpacity
                    key={`${i}_${j}`}
                    onPress={() => setSelectedItem(i)}
                    style={{ padding: 2 }}
                  >
                    <SSText
                      type="mono"
                      style={{
                        color: colors[item.field as TxField],
                        ...(selected ? styles.selected : styles.faded)
                      }}
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

      <SSTxDecodedField {...decoded[selectedItem]} />
    </SSVStack>
  )
}

function SSTxDecodedField({ hex, field, value, placeholders }: TxDecodedField) {
  let label = i18n.t(`txDecoded.label.${field}`)
  let description = i18n.t(`txDecoded.description.${field}`)

  label = replacePlaceholders(label, placeholders?.label || [])
  description = replacePlaceholders(
    description,
    placeholders?.description || []
  )

  return (
    <SSVStack gap="none">
      <SSText weight="bold">
        Hex:{' '}
        <SSText
          uppercase
          type="mono"
          style={{ color: colors[field as TxField] }}
        >
          {hex}
        </SSText>
      </SSText>
      <SSText weight="bold">
        Label: <SSText type="mono">{label}</SSText>
      </SSText>
      <SSText weight="bold">
        Value:{' '}
        <SSText type="mono" uppercase>
          {value}
        </SSText>
      </SSText>
      <SSText weight="bold">
        Description: <SSText size="xs">{description}</SSText>
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  selected: {
    textDecorationLine: 'underline',
    textTransform: 'uppercase'
  },
  faded: {
    opacity: 0.5
  }
})
