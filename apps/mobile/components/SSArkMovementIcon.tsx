import {
  SSIconBoardCircle,
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOffboardCircle,
  SSIconOutgoing,
  SSIconOutgoingLightning,
  SSIconRefresh
} from '@/components/icons'
import { Colors } from '@/styles'
import type { ArkMovementKind } from '@/types/models/Ark'

type SSArkMovementIconProps = {
  kind: ArkMovementKind
  isLightning: boolean
  size: number
}

function SSArkMovementIcon({
  kind,
  isLightning,
  size
}: SSArkMovementIconProps) {
  if (kind === 'refresh') {
    return <SSIconRefresh height={size} width={size} />
  }
  if (kind === 'board') {
    return (
      <SSIconBoardCircle height={size} width={size} stroke={Colors.mainGreen} />
    )
  }
  if (kind === 'offboard') {
    return (
      <SSIconOffboardCircle
        height={size}
        width={size}
        stroke={Colors.mainRed}
      />
    )
  }
  if (kind === 'receive') {
    return isLightning ? (
      <SSIconIncomingLightning height={size} width={size} />
    ) : (
      <SSIconIncoming height={size} width={size} />
    )
  }
  return isLightning ? (
    <SSIconOutgoingLightning height={size} width={size} />
  ) : (
    <SSIconOutgoing height={size} width={size} />
  )
}

export default SSArkMovementIcon
