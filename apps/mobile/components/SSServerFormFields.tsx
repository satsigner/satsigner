import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Backend } from '@/types/settings/blockchain'

type SSServerFormFieldsProps = {
  backend: Backend
  name: string
  host: string
  port: string
  onNameChange: (name: string) => void
  onHostChange: (host: string) => void
  onPortChange: (port: string) => void
}

function SSServerFormFields({
  backend,
  name,
  host,
  port,
  onNameChange,
  onHostChange,
  onPortChange
}: SSServerFormFieldsProps) {
  return (
    <SSVStack gap="md">
      <SSVStack gap="sm">
        <SSText uppercase>{t('common.name')}</SSText>
        <SSTextInput value={name} onChangeText={onNameChange} />
      </SSVStack>

      <SSVStack gap="sm">
        <SSText uppercase>{t('settings.network.server.host')}</SSText>
        <SSTextInput
          value={host}
          onChangeText={onHostChange}
          placeholder={
            backend === 'electrum'
              ? '192.168.0.144 or electrum.example.com'
              : 'mempool.space or api.example.com'
          }
        />
      </SSVStack>

      <SSVStack gap="sm">
        <SSText uppercase>{t('settings.network.server.port')}</SSText>
        <SSTextInput
          value={port}
          onChangeText={onPortChange}
          placeholder={
            backend === 'electrum' ? '50001 (tcp) or 50002 (ssl)' : '443 or 80'
          }
          keyboardType="numeric"
        />
      </SSVStack>
    </SSVStack>
  )
}

export default SSServerFormFields
