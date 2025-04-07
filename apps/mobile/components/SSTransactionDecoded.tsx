import { Fragment, useMemo, useState } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { TxDecoded, type TxDecodedField } from '@/utils/txDecoded'

import { SSIconChevronDown, SSIconChevronUp } from './icons'
import SSText from './SSText'

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
        <SSHStack gap="sm" style={{ justifyContent: 'flex-end' }}>
          <SSText color="muted">
            {display === 'list'
              ? t('transaction.decoded.btnCollapse')
              : t('transaction.decoded.btnExpand')}
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
      <SSTransactionDecodedItem {...decoded[selectedItem]} />
    </SSVStack>
  )
}

function SSTransactionDecodedList({
  decoded
}: SSTransactionDecodedDisplayProps) {
  return (
    <SSVStack>
      {decoded.map((item, index) => {
        return <SSTransactionDecodedItem key={index} {...item} />
      })}
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
      <SSText weight="bold">
        {t(`transaction.decoded.label.${field}`, { ...placeholders })}
      </SSText>
      <SSText color="muted">{value}</SSText>
      <SSText color="muted" size="xxs">
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

export default SSTransactionDecoded
