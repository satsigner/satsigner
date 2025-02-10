import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { TxDecoded, TxDecodedField } from '@/utils/txDecoded'

import SSText from './SSText'

type SSTranssctionDecodedProps = {
  txHex: string
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
  return (
    <SSVStack gap="xs">
      <SSText color="muted" type="mono">
        {t(`transaction.decoded.label.${field}`, { ...placeholders })}
      </SSText>
      <SSText type="mono">{value}</SSText>
      <SSText color="muted">
        {t(`transaction.decoded.description.${field}`, { ...placeholders })}
      </SSText>
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
