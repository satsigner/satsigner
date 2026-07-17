import { StyleSheet } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSDetailsList from '@/components/SSDetailsList'
import SSIconButton from '@/components/SSIconButton'
import SSLabelTags from '@/components/SSLabelTags'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { ArkAddress } from '@/types/models/Ark'
import { formatNumber } from '@/utils/format'

import { SSIconEditPencil } from './icons'

const EDIT_ICON_SIZE = 16

type SSArkAddressCardProps = {
  address: ArkAddress
  label?: string
  onEditLabel?: (address: string) => void
}

function SSArkAddressCard({
  address,
  label = '',
  onEditLabel
}: SSArkAddressCardProps) {
  return (
    <SSVStack gap="sm" style={address.used ? undefined : styles.unused}>
      <SSHStack justifyBetween>
        <SSText uppercase weight="bold">
          {t('ark.address.index', { index: address.index })}
        </SSText>
        <SSHStack gap="sm">
          <SSText size="xs" color="muted" uppercase>
            {address.used ? t('ark.address.used') : t('ark.address.unused')}
          </SSText>
          {onEditLabel && (
            <SSIconButton onPress={() => onEditLabel(address.address)}>
              <SSIconEditPencil
                height={EDIT_ICON_SIZE}
                width={EDIT_ICON_SIZE}
              />
            </SSIconButton>
          )}
        </SSHStack>
      </SSHStack>
      <SSLabelTags label={label} />
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
