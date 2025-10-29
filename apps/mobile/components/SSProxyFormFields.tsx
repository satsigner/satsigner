import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type ProxyConfig } from '@/types/settings/blockchain'

type SSProxyFormFieldsProps = {
  proxy: ProxyConfig
  onProxyChange: (proxy: ProxyConfig) => void
}

function SSProxyFormFields({ proxy, onProxyChange }: SSProxyFormFieldsProps) {
  function handleEnableChange(enabled: boolean) {
    onProxyChange({
      ...proxy,
      enabled
    })
  }

  function handleHostChange(host: string) {
    onProxyChange({
      ...proxy,
      host
    })
  }

  function handlePortChange(port: string) {
    const portNum = parseInt(port, 10)
    if (!isNaN(portNum)) {
      onProxyChange({
        ...proxy,
        port: portNum
      })
    }
  }

  return (
    <SSVStack gap="md">
      <SSCheckbox
        selected={proxy.enabled}
        onPress={() => handleEnableChange(!proxy.enabled)}
        label={t('settings.network.server.proxy.enable')}
      />
      {proxy.enabled && (
        <>
          <SSText color="muted" size="sm">
            {t('settings.network.server.proxy.description')}
          </SSText>
          <SSVStack gap="sm">
            <SSText uppercase>
              {t('settings.network.server.proxy.hostLabel')}
            </SSText>
            <SSTextInput
              value={proxy.host}
              onChangeText={handleHostChange}
              placeholder={t('settings.network.server.proxy.host.placeholder')}
            />
          </SSVStack>
          <SSVStack gap="sm">
            <SSText uppercase>
              {t('settings.network.server.proxy.portLabel')}
            </SSText>
            <SSTextInput
              value={proxy.port.toString()}
              onChangeText={handlePortChange}
              placeholder={t('settings.network.server.proxy.port.placeholder')}
              keyboardType="numeric"
            />
          </SSVStack>
        </>
      )}
    </SSVStack>
  )
}

export default SSProxyFormFields
