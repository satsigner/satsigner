import { FlashList } from '@shopify/flash-list'
import { useCallback } from 'react'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { formatAddress } from '@/utils/format'

import SSText from './SSText'

type ChildAccount = {
  index: number
  address: string
  label: string | undefined
  unspendSats: number | null
  txs: number
}

function SSChildAccountList({
  childAccounts
}: {
  childAccounts: ChildAccount[]
}) {
  const renderItem = useCallback(
    ({ item }: { item: ChildAccount }) => (
      <SSHStack
        style={{
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderColor: '#333',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <SSText
          style={{
            fontWeight: 'bold',
            color: '#fff',
            textAlign: 'center',
            flex: 1
          }}
        >
          {item.index}
        </SSText>
        <SSText style={{ color: '#fff', textAlign: 'center', flex: 2 }}>
          {formatAddress(item.address, 4)}
        </SSText>
        <SSText
          style={{
            color: item.label ? '#fff' : '#333333',
            textAlign: 'center',
            flex: 2
          }}
        >
          {item.label || t('transaction.noLabel')}
        </SSText>
        <SSText
          style={{
            color:
              item.unspendSats === 0 && item.txs === 0 ? '#333333' : '#fff',
            textAlign: 'center',
            flex: 2
          }}
        >
          {item.unspendSats}
        </SSText>
        <SSText
          style={{
            color:
              item.unspendSats === 0 && item.txs === 0 ? '#333333' : '#fff',
            textAlign: 'center',
            flex: 1
          }}
        >
          {item.txs}
        </SSText>
      </SSHStack>
    ),
    []
  )

  return (
    <FlashList
      data={childAccounts}
      renderItem={renderItem}
      estimatedItemSize={150}
      keyExtractor={(item) => `${item.index}-${item.address}`}
      removeClippedSubviews
    />
  )
}

export default SSChildAccountList
