import { StyleSheet, TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { type WatchedAddress } from '@/types/models/Address'

import { SSIconEyeOn, SSIconTrash } from './icons'

type AddressCardProps = {
  address: WatchedAddress
  allowDelete: boolean
  index: number
  onViewDetails: () => void
  onDelete: () => void
}

const tl = tn('account.settings.manageAddresses')

export function AddressCard({
  address,
  allowDelete,
  index,
  onViewDetails,
  onDelete
}: AddressCardProps) {
  return (
    <SSVStack gap="sm">
      <SSHStack justifyBetween>
        <SSText uppercase weight="bold">
          {address.new
            ? tl('addressIndexNew', { index })
            : tl('addressIndex', { index })}
        </SSText>
        <SSHStack gap="sm">
          <TouchableOpacity onPress={onViewDetails}>
            <SSIconEyeOn width={16} height={16} />
          </TouchableOpacity>
          {allowDelete && (
            <TouchableOpacity onPress={onDelete}>
              <SSIconTrash width={16} height={16} />
            </TouchableOpacity>
          )}
        </SSHStack>
      </SSHStack>
      <SSAddressDisplay address={address.address} />
      {!address.new && (
        <SSVStack gap="none">
          <SSText>
            {tl('summary.balance')}{' '}
            <SSStyledSatText
              amount={address.summary.balance}
              textSize="sm"
              noColor
            />{' '}
            {t('bitcoin.sats')}
          </SSText>
          {address.summary.satsInMempool > 0 && (
            <SSText>
              {tl('summary.balanceUncofirmed')}{' '}
              <SSStyledSatText
                amount={address.summary.satsInMempool}
                textSize="sm"
                noColor
              />
              {t('bitcoin.sats')}
            </SSText>
          )}
          <SSText>
            {tl('summary.utxo')}{' '}
            <SSText weight="bold">{address.summary.utxos}</SSText>
          </SSText>
          <SSText>
            {tl('summary.tx')}{' '}
            <SSText weight="bold">{address.summary.transactions}</SSText>
          </SSText>
          <SSText>
            {t('common.label')}{' '}
            {address.label ? (
              <SSText weight="bold">{address.label}</SSText>
            ) : (
              <SSText color="muted">{t('common.noLabel')}</SSText>
            )}
          </SSText>
        </SSVStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  addressActionButton: {
    width: '48%',
    padding: 12,
    height: 'auto'
  }
})
