import { View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

type SSBlockFeePriceRowProps = {
  blockHeight: number | null | undefined
  btcPrice: number
  fiatCurrency: string
  nextBlockFee: number | string | null | undefined
}

function SSBlockFeePriceRow({
  blockHeight,
  nextBlockFee,
  btcPrice,
  fiatCurrency
}: SSBlockFeePriceRowProps) {
  return (
    <SSHStack gap="xxs" style={{ justifyContent: 'center' }}>
      <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
        Block{' '}
      </SSText>
      <SSText size="xxs" style={{ color: Colors.gray['200'] }}>
        {blockHeight?.toLocaleString() ?? '--'}
      </SSText>
      <View style={{ width: 8 }} />
      <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
        ~
        <SSText size="xxs" style={{ color: Colors.gray['200'] }}>
          {nextBlockFee ?? '--'}
        </SSText>
        {' sat/vB'}
      </SSText>
      <View style={{ width: 12 }} />
      <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
        <SSText size="xxs" style={{ color: Colors.gray['200'] }}>
          {btcPrice > 0
            ? btcPrice.toLocaleString(undefined, {
                maximumFractionDigits: 0
              })
            : '--'}
        </SSText>
        {` ${fiatCurrency}`}
      </SSText>
    </SSHStack>
  )
}

export default SSBlockFeePriceRow
