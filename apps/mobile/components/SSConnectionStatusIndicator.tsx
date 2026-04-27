import { View } from 'react-native'

import {
  SSIconGreenIndicator,
  SSIconGreyIndicator,
  SSIconMutedRedIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import { type ConnectionVerifyStatus } from '@/hooks/useVerifyConnection'

type Props = {
  isPrivateConnection: boolean
  size?: number
  status: ConnectionVerifyStatus
}

const DOT_NUDGE_UP = 1

export default function SSConnectionStatusIndicator({
  isPrivateConnection,
  size = 24,
  status
}: Props) {
  let node
  if (status === 'checking') {
    node = <SSIconGreyIndicator height={size} width={size} />
  } else if (status === 'failed') {
    node = <SSIconMutedRedIndicator height={size} width={size} />
  } else if (isPrivateConnection) {
    node = <SSIconYellowIndicator height={size} width={size} />
  } else {
    node = <SSIconGreenIndicator height={size} width={size} />
  }

  return <View style={{ marginTop: -DOT_NUDGE_UP }}>{node}</View>
}
