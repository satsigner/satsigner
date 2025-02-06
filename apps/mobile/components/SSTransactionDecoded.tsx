import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { TxDecoded, TxDecodedField } from '@/utils/txDecoded'

import SSText from './SSText'

type SSTranssctionDecodedProps = {
  txHex: string
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

export default function SSTransactionDecoded({
  txHex
}: SSTranssctionDecodedProps) {
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
                  >
                    <SSText
                      type="mono"
                      size="md"
                      style={
                        selected
                          ? styles.highlighted
                          : i % 2
                            ? styles.fadedDarker
                            : styles.fadedNormal
                      }
                    >
                      {byte}
                    </SSText>
                  </TouchableOpacity>
                )
              })}
              {byteChunks.length && (
                <SSText type="mono" size="md" style={styles.fadedBrighter}>
                  ||
                </SSText>
              )}
            </Fragment>
          )
        })}
      </SSHStack>
      <SSTxDecodedField {...decoded[selectedItem]} />
    </SSVStack>
  )
}

function SSTxDecodedField({ field, value, placeholders }: TxDecodedField) {
  let label = i18n.t(`txDecoded.label.${field}`)
  let description = i18n.t(`txDecoded.description.${field}`)

  label = replacePlaceholders(label, placeholders?.label || [])
  description = replacePlaceholders(
    description,
    placeholders?.description || []
  )

  return (
    <SSVStack gap="xs">
      <SSText color="muted" type="mono">
        {label}
      </SSText>
      <SSText type="mono">{value}</SSText>
      <SSText color="muted">{description}</SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  highlighted: {
    backgroundColor: 'white',
    color: 'black',
    padding: 2
  },
  fadedDarker: {
    color: Colors.gray[600],
    padding: 2
  },
  fadedNormal: {
    color: Colors.gray[400],
    padding: 2
  },
  fadedBrighter: {
    color: Colors.gray[100],
    padding: 2
  }
})
