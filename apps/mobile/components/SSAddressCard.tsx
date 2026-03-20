import { TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { type WatchedAddress } from '@/types/models/Address'
import { formatNumber } from '@/utils/format'

import { SSIconEyeOn, SSIconTrash } from './icons'
import SSDetailsList from './SSDetailsList'

type AddressCardProps = {
  address: WatchedAddress
  showDelete?: boolean
  showView?: boolean
  onViewDetails?: () => void
  onDelete?: () => void
}

const tl = tn('account.settings.manageAddresses')

export function AddressCard({
  address,
  showDelete = false,
  showView = false,
  onViewDetails,
  onDelete
}: AddressCardProps) {
  const index = address.index !== undefined ? address.index : -1
  return (
    <SSVStack gap="sm">
      <SSHStack justifyBetween>
        <SSText uppercase weight="bold">
          {index === -1
            ? t('bitcoin.address')
            : address.new
              ? tl('addressIndexNew', { index })
              : tl('addressIndex', { index })}
        </SSText>
        <SSHStack gap="sm">
          {showView && (
            <TouchableOpacity onPress={onViewDetails}>
              <SSIconEyeOn width={16} height={16} />
            </TouchableOpacity>
          )}
          {showDelete && (
            <TouchableOpacity onPress={onDelete}>
              <SSIconTrash width={16} height={16} />
            </TouchableOpacity>
          )}
        </SSHStack>
      </SSHStack>
      <SSAddressDisplay address={address.address} />
      {!address.new && (
        <SSDetailsList
          columns={2}
          items={[
            [tl('summary.balance'), address.summary.balance],
            [
              tl('summary.balanceUncofirmed'),
              formatNumber(address.summary.satsInMempool)
            ],
            [tl('summary.tx'), formatNumber(address.summary.transactions)],
            [tl('summary.utxo'), formatNumber(address.summary.utxos)],
            [t('common.label'), address.label, { width: '100%' }]
          ]}
        />
      )}
    </SSVStack>
  )
}
