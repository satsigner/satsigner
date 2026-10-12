import { TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'

import { SSIconInfo } from './icons'
import SSText from './SSText'

type SSBitcoinNetworkExplanationLinkProps = {
  onPress: () => void
}

function SSBitcoinNetworkExplanationLink({
  onPress
}: SSBitcoinNetworkExplanationLinkProps) {
  return (
    <TouchableOpacity onPress={onPress}>
      <SSHStack gap="xs" style={{ justifyContent: 'center' }}>
        <SSText color="muted">
          {t('settings.network.networkComparisonLink')}
        </SSText>
        <SSIconInfo height={16} width={16} />
      </SSHStack>
    </TouchableOpacity>
  )
}

export default SSBitcoinNetworkExplanationLink
