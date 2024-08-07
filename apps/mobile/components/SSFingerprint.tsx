import SSHStack from '@/layouts/SSHStack'
import { i18n } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSFingerprintProps = {
  value: string
}

export default function SSFingerprint({ value }: SSFingerprintProps) {
  return (
    <SSHStack gap="xs">
      <SSText style={{ color: Colors.gray[500] }}>
        {i18n.t('bitcoin.fingerprint')}
      </SSText>
      <SSText color="muted">{value}</SSText>
    </SSHStack>
  )
}
