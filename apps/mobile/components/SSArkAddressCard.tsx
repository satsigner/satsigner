import { StyleSheet } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSDetailsList from '@/components/SSDetailsList'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { ArkAddress } from '@/types/models/Ark'
import { formatNumber } from '@/utils/format'

type SSArkAddressCardProps = {
  address: ArkAddress
}

function SSArkAddressCard({ address }: SSArkAddressCardProps) {
  return (
    <SSVStack gap="sm" style={address.used ? undefined : styles.unused}>
      <SSHStack justifyBetween>
        <SSText uppercase weight="bold">
          {t('ark.address.index', { index: address.index })}
        </SSText>
        <SSText size="xs" color="muted" uppercase>
          {address.used ? t('ark.address.used') : t('ark.address.unused')}
        </SSText>
      </SSHStack>
      <SSAddressDisplay address={address.address} />
      <SSDetailsList
        columns={2}
        items={[
          [t('ark.address.received'), formatNumber(address.receivedSats)],
          [t('ark.address.receiveCount'), formatNumber(address.receiveCount)]
        ]}
      />
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  unused: {
    opacity: 0.5
  }
})

export default SSArkAddressCard
