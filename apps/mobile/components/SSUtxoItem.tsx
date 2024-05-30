import { Image } from 'expo-image'
import { useMemo } from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'
import { Utxo } from '@/types/models/Utxo'
import { formatAddress, formatDate, formatNumber } from '@/utils/format'

import SSText from './SSText'
import SSUtxoSizeMeter from './SSUtxoSizeMeter'

type SSUtxoItemProps = {
  utxo: Utxo
  selected: boolean
  largestValue: number
  onToggleSelected(utxo: Utxo): void
}

export default function SSUtxoItem({
  utxo,
  selected,
  largestValue,
  onToggleSelected
}: SSUtxoItemProps) {
  const selectIconStyle = useMemo(() => {
    return StyleSheet.compose(styles.selectIconBase, {
      ...(selected
        ? { backgroundColor: Colors.error }
        : { backgroundColor: Colors.gray[500] })
    })
  }, [selected])

  return (
    <View>
      <TouchableOpacity onPress={() => onToggleSelected(utxo)}>
        <SSHStack
          style={{
            paddingHorizontal: '5%',
            paddingVertical: 16
          }}
          justifyBetween
        >
          <SSHStack>
            <View style={selectIconStyle}>
              {selected ? (
                <Image
                  style={{ width: 8, height: 8 }}
                  source={require('@/assets/icons/x.svg')}
                />
              ) : (
                <Image
                  style={{ width: 8, height: 8 }}
                  source={require('@/assets/icons/x.svg')}
                />
              )}
            </View>
            <SSVStack gap="xs">
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText size="md" color="white">
                  {formatNumber(utxo.value)}
                </SSText>
                <SSText size="xs" color="muted">
                  {i18n.t('bitcoin.sats').toLowerCase()}
                </SSText>
              </SSHStack>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="white">0.72</SSText>
                <SSText color="muted">USD</SSText>
              </SSHStack>
              <SSText>
                {utxo.label && `${i18n.t('bitcoin.memo')}: ${utxo.label}`}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSVStack gap="xs" style={{ alignSelf: 'flex-start' }}>
            <SSText>
              {utxo.addressTo ? formatAddress(utxo.addressTo) : ''}
            </SSText>
            <SSText style={{ color: Colors.gray[100], alignSelf: 'flex-end' }}>
              {utxo.timestamp ? formatDate(utxo.timestamp) : ''}
            </SSText>
          </SSVStack>
        </SSHStack>
      </TouchableOpacity>
      <SSUtxoSizeMeter
        size={utxo.value}
        largestSize={largestValue}
        selected={selected}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  selectIconBase: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'baseline',
    height: 20,
    width: 20,
    borderRadius: 10,
    marginTop: 2
  }
})
