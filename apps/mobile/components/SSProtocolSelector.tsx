import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

type SSProtocolSelectorProps = {
  backend: 'electrum' | 'esplora'
  protocol: 'tcp' | 'ssl' | 'tls'
  onProtocolChange: (protocol: 'tcp' | 'ssl' | 'tls') => void
}

function SSProtocolSelector({
  backend,
  protocol,
  onProtocolChange
}: SSProtocolSelectorProps) {
  if (backend === 'esplora') {
    return (
      <SSVStack gap="sm">
        <SSText uppercase>{t('settings.network.server.protocol')}</SSText>
        <SSText color="muted" size="sm">
          HTTPS (automatic for Esplora)
        </SSText>
      </SSVStack>
    )
  }

  return (
    <SSVStack gap="sm">
      <SSText uppercase>{t('settings.network.server.protocol')}</SSText>
      <SSHStack gap="sm" style={{ flex: 1 }}>
        {(['tcp', 'ssl'] as const).map((protocolOption) => (
          <SSButton
            key={protocolOption}
            label={`${protocolOption}://`}
            variant={protocol === protocolOption ? 'secondary' : 'ghost'}
            style={{
              flex: 1,
              borderWidth: protocol === protocolOption ? 0 : 1,
              borderColor: Colors.gray[300]
            }}
            onPress={() => onProtocolChange(protocolOption)}
          />
        ))}
      </SSHStack>
    </SSVStack>
  )
}

export default SSProtocolSelector
