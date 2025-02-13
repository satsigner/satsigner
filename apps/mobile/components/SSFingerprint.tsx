import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

import SSText from './SSText'

type SSFingerprintProps = {
  value: string
}

function SSFingerprint({ value }: SSFingerprintProps) {
  return (
    <SSHStack gap="xs">
      <SSText style={{ color: Colors.gray[500] }}>
        {t('bitcoin.fingerprint')}
      </SSText>
      <SSText color="muted">{value}</SSText>
    </SSHStack>
  )
}

export default SSFingerprint
