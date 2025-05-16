import { router } from 'expo-router'
import { TouchableOpacity } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'

import { SSIconInfo } from './icons'
import SSText from './SSText'

function SSBitcoinNetworkExplanationLink() {
  return (
    <TouchableOpacity
      onPress={() => {
        router.navigate('/settings/network/comparison')
      }}
    >
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
