import {
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOutgoing,
  SSIconOutgoingLightning,
  SSIconRefresh
} from '@/components/icons'
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
