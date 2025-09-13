import { TouchableOpacity } from 'react-native'

import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Backend } from '@/types/settings/blockchain'

type SSBackendSelectorProps = {
  backend: Backend
  onBackendChange: (backend: Backend) => void
}

function SSBackendSelector({
  backend,
  onBackendChange
}: SSBackendSelectorProps) {
  const backends: Backend[] = ['electrum', 'esplora']

  return (
    <SSVStack>
      <SSText uppercase>{t('settings.network.server.backend')}</SSText>
      {backends.map((be) => (
        <SSHStack key={be}>
          <SSCheckbox
            key={be}
            selected={be === backend}
            onPress={() => onBackendChange(be)}
          />
          <TouchableOpacity onPress={() => onBackendChange(be)}>
            <SSVStack gap="none" justifyBetween>
              <SSText
                style={{ lineHeight: 18, textTransform: 'capitalize' }}
                size="md"
              >
                {be}
              </SSText>
              <SSText style={{ lineHeight: 14 }} color="muted">
                {t(`settings.network.backend.${be}.description`)}
              </SSText>
            </SSVStack>
          </TouchableOpacity>
        </SSHStack>
      ))}
    </SSVStack>
  )
}

export default SSBackendSelector
