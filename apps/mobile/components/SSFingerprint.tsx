import { View } from 'react-native'

import { SSIconCircle } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import type { TextFontSize } from '@/styles/sizes'

const FINGERPRINT_CIRCLE_INSET = 2

type SSFingerprintProps = {
  fingerprint?: string
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
  const sizeValue = Sizes.text.fontSize[size]
  const circleSize = sizeValue - FINGERPRINT_CIRCLE_INSET

  return (
    <SSHStack gap="sm" style={{ alignItems: 'center', minHeight: sizeValue }}>
      {withLabel ? (
        <SSText size={size} style={{ color: Colors.gray[500] }}>
          {t('bitcoin.fingerprint')}
        </SSText>
      ) : null}
      <SSHStack gap="xs" style={{ alignItems: 'center', minHeight: sizeValue }}>
        {withColor ? (
          fingerprint ? (
            <SSIconCircle
              size={circleSize}
              fill={`#${fingerprint.slice(0, 6)}`}
            />
          ) : (
            <View style={{ height: circleSize, width: circleSize }} />
          )
        ) : null}
        <SSText color="muted" size={size} style={{ lineHeight: sizeValue }}>
          {fingerprint || '-'}
        </SSText>
      </SSHStack>
    </SSHStack>
  )
}
