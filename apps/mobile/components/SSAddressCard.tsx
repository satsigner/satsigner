import { StyleSheet } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t, tn } from '@/locales'
import { type WatchedAddress } from '@/types/models/Address'

type AddressCardProps = {
  address: WatchedAddress
  index: number
  onViewDetails: () => void
  onDelete: () => void
}

const tl = tn('account.settings.manageAddresses')

export function AddressCard({
  address,
  index,
  onViewDetails,
  onDelete
}: AddressCardProps) {
  return (
    <SSVStack gap="sm">
      <SSText uppercase weight="bold">
        {address.new
          ? tl('addressIndexNew', { index })
          : tl('addressIndex', { index })}
      </SSText>
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
      <SSHStack gap="sm" justifyBetween>
        <SSButton
          style={styles.addressActionButton}
          label={tl('detailsBtn').toUpperCase()}
          variant="secondary"
          disabled={address.new}
          onPress={onViewDetails}
        />
        <SSButton
          style={styles.addressActionButton}
          label={tl('deleteBtn').toUpperCase()}
          variant="danger"
          onPress={onDelete}
        />
      </SSHStack>
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
