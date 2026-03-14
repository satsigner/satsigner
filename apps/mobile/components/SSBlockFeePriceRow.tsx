import { useRouter } from 'expo-router'
import { TouchableOpacity, View } from 'react-native'

import SSText from '@/components/SSText'
import type { BlockHeightSource } from '@/hooks/useNetworkInfo'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

type SSBlockFeePriceRowProps = {
  blockHeight: number | null | undefined
  btcPrice: number
  fiatCurrency: string
  nextBlockFee: number | string | null | undefined
  blockHeightSource?: BlockHeightSource | null
}

function SSBlockFeePriceRow({
  blockHeight,
  nextBlockFee,
  btcPrice,
  fiatCurrency,
  blockHeightSource
}: SSBlockFeePriceRowProps) {
  const router = useRouter()

  const blockHeightColor =
    blockHeightSource === 'backend' ? Colors.white : Colors.gray['500']

  return (
    <TouchableOpacity
      onPress={() => router.navigate('/explorer/chaintip')}
      activeOpacity={0.7}
    >
      <SSHStack gap="xxs" style={{ justifyContent: 'center' }}>
        <SSText size="xxs" style={{ color: Colors.gray['500'] }}>
          Block{' '}
        </SSText>
        <SSText size="xxs" style={{ color: blockHeightColor }}>
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
    </TouchableOpacity>
  )
}

export default SSBlockFeePriceRow
