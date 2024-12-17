import { Transaction as TransactionBdk } from 'bdk-rn'
import React from 'react'
import { View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSConsoleOutput from '@/components/SSConsoleOutput'
import { type Transaction } from '@/types/models/Transaction'

type SSBdkTransactionConsoleProps = {
  transaction: Transaction
}

export default function SSBdkTransactionConsole({
  transaction
}: SSBdkTransactionConsoleProps) {
  const [generating, setGenerating] = React.useState(false)
  const [consoleTxt, setConsoleTxt] = React.useState([''])

  async function handleButtonPress(): Promise<void> {
    setGenerating(true)
    try {
      // ToDo get mutinynet url from settings
      const response = await fetch(
        'https://mutinynet.com/api' + '/tx/' + transaction.id + '/hex'
      )
      const txt = await response.text()
      const bytes = asciiHexToBytes(txt)

      const tranBdk1 = new TransactionBdk()
      const tranBdk2 = await tranBdk1.create(bytes)

      const txid = await tranBdk2.txid()
      const inputs = await tranBdk2.input()
      const outputs = await tranBdk2.output()
      const isCoinBase = await tranBdk2.isCoinBase()
      const isExplicitlyRbf = await tranBdk2.isExplicitlyRbf()
      const isLockTimeEnabled = await tranBdk2.isLockTimeEnabled()
      const lockTime = await tranBdk2.lockTime()
      const serialize = await tranBdk2.serialize()
      const size = await tranBdk2.size()
      const version = await tranBdk2.version()
      const vsize = await tranBdk2.vsize()
      const weight = await tranBdk2.weight()

      const lines: [string] = ['METHODS ON BDK TRANSACTION OBJECT']
      lines.push('Transaction.txid(): ' + txid)
      lines.push('Transaction.input().length: ' + inputs.length.toString())
      lines.push('Transaction.output().length: ' + outputs.length.toString())
      lines.push('Transaction.isCoinBase(): ' + isCoinBase.toString())
      lines.push('Transaction.isExplicitlyRbf(): ' + isExplicitlyRbf.toString())
      lines.push(
        'Transaction.isLockTimeEnabled(): ' + isLockTimeEnabled.toString()
      )
      lines.push('Transaction.lockTime(): ' + lockTime.toString())
      lines.push(
        'Transaction.serialize().length: ' + serialize.length.toString()
      )
      lines.push('Transaction.size(): ' + size.toString())
      lines.push('Transaction.version(): ' + version.toString())
      lines.push('Transaction.vsize(): ' + vsize.toString())
      lines.push('Transaction.weight(): ' + weight.toString())

      setConsoleTxt(lines)
      setGenerating(false)
    } catch (error: any) {
      setConsoleTxt([error])
      setGenerating(false)
    }
  }

  function asciiHexToBytes(hex: string): number[] {
    const byteCount: number = hex.length / 2
    const byteArray: number[] = Array(byteCount)
    for (let i = 0; i < byteCount; i++) {
      const byteAsciiHex = hex.substring(i * 2, i * 2 + 2)
      byteArray[i] = parseInt(byteAsciiHex, 16)
    }
    return byteArray
  }

  return (
    <View>
      <SSButton label={'BDK Info (Transaction)'} onPress={handleButtonPress} />
      <SSConsoleOutput generating={generating} consoleTxt={consoleTxt} />
    </View>
  )
}
