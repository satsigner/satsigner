import { View } from 'react-native'

import { SSIconStatusDot, SSIconTor } from '@/components/icons'
import { type ConnectionVerifyStatus } from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'
import { type ServerPrivacy } from '@/utils/serverPrivacy'
import { serverStatusDotColor } from '@/utils/serverStatusDisplay'

type Props = {
  isOnion?: boolean
  privacy: ServerPrivacy
  size?: number
  status: ConnectionVerifyStatus
}

const DOT_NUDGE_UP = 1
const TOR_ICON_RATIO = 0.5
const TOR_ICON_OVERLAP_RATIO = 0.2

export default function SSConnectionStatusIndicator({
  isOnion = false,
  privacy,
  size = 24,
  status
}: Props) {
  const torSize = Math.round(size * TOR_ICON_RATIO)
  return (
    <SSHStack gap="none" style={{ marginTop: -DOT_NUDGE_UP }}>
      <SSIconStatusDot
        color={serverStatusDotColor(status, privacy)}
        height={size}
        width={size}
      />
      {isOnion && (
        <View style={{ marginLeft: -size * TOR_ICON_OVERLAP_RATIO }}>
          <SSIconTor
            width={torSize}
            height={torSize}
            color={Colors.gray[200]}
          />
        </View>
      )}
    </SSHStack>
  )
}
