import { SSIconCircle } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Sizes, Colors, type TextFontSize } from '@/styles'

type SSFingerprintProps = {
  fingerprint: string
  size?: TextFontSize
  withLabel?: boolean
  withColor?: boolean
}

export default function SSFingerprint({
  fingerprint,
  size = 'xs',
  withLabel = false,
  withColor = true
}: SSFingerprintProps) {
  const sizeValue = Sizes['text']['fontSize'][size]
  return (
    <SSHStack gap="sm" style={{ alignItems: 'center' }}>
      {withLabel && (
        <SSText size={size} style={{ color: Colors.gray[500] }}>
          {t('bitcoin.fingerprint')}
        </SSText>
      )}
      <SSHStack gap="xxs" style={{ alignItems: 'flex-start' }}>
        {withColor && fingerprint && (
          <SSIconCircle
            size={sizeValue + 1}
            fill={`#${fingerprint.slice(0, 6)}`}
          />
        )}
        <SSText color="muted" size={size} style={{ lineHeight: sizeValue }}>
          {fingerprint || '-'}
        </SSText>
      </SSHStack>
    </SSHStack>
  )
}
