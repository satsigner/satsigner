import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'

import { SSIconInfo } from './icons'
import SSPressable from './SSPressable'
import SSText from './SSText'

type SSBitcoinNetworkExplanationLinkProps = {
  onPress: () => void
}

function SSBitcoinNetworkExplanationLink({
  onPress
}: SSBitcoinNetworkExplanationLinkProps) {
  return (
    <SSPressable onPress={onPress}>
      <SSHStack gap="xs" style={{ justifyContent: 'center' }}>
        <SSText color="muted">
          {t('settings.network.networkComparisonLink')}
        </SSText>
        <SSIconInfo height={16} width={16} />
      </SSHStack>
    </SSPressable>
  )
}

export default SSBitcoinNetworkExplanationLink
