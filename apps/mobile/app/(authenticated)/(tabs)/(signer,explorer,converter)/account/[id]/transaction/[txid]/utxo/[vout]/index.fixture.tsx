import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { parseHexToBytes } from '@/utils/parse'

import { UtxoDetails } from '.'

function UtxoDetailsFixture() {
  const { height } = useWindowDimensions()

  const tx = {
    id: '44887de856949bbb690a7e664d7d5fad7c4a099a6e5d24059771660712d5c39b',
    type: 'receive',
    sent: 0,
    received: 0,
    label: '',
    blockHeight: 800_000,
    timestamp: new Date(),
    lockTimeEnabled: false,
    vin: [],
    vout: [],
    prices: {}
  } as Transaction

  const utxo = {
    txid: tx.id,
    vout: 0,
    value: 5000,
    addressTo: '1EvPLx2jb87RwGP4n4CxuucFVzsdu3ksRa',
    label: 'From a friend #nokyc #friend',
    keychain: 'external',
    script: parseHexToBytes(
      '76a91498b2553c30629340fac2a7729cf2f2100cdbb98d88ac'
    )
  } as Utxo

  return (
    <View style={[styles.container, { height }]}>
      <UtxoDetails
        accountId="test"
        onPressTx={() => null}
        onPressAddress={() => null}
        tx={tx}
        utxo={utxo}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 5,
    justifyContent: 'center',
    backgroundColor: '#000'
  }
})

export default UtxoDetailsFixture
