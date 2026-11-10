import { type ConnectionVerifyStatus } from '@/hooks/useVerifyConnection'
import { Colors } from '@/styles'
import { type ServerPrivacy } from '@/utils/serverPrivacy'

const PRIVACY_DOT_COLORS: Record<
  ServerPrivacy,
  { live: string; muted: string }
> = {
  node: { live: Colors.serverNode, muted: Colors.serverNodeMuted },
  private: { live: Colors.serverPrivate, muted: Colors.serverPrivateMuted },
  public: { live: Colors.serverPublic, muted: Colors.serverPublicMuted }
}

export const SERVER_STATUS_LABEL_KEYS: Record<ConnectionVerifyStatus, string> =
  {
    checking: 'status.checking',
    connected: 'status.connected',
    failed: 'status.unreachable',
    idle: 'status.idle'
  }

export function serverStatusDotColor(
  status: ConnectionVerifyStatus,
  privacy: ServerPrivacy
) {
  if (status === 'failed') {
    return Colors.softBarRed
  }
  const colors = PRIVACY_DOT_COLORS[privacy]
  return status === 'connected' ? colors.live : colors.muted
}

// The muted dot shades are too dark to read as text.
export function serverStatusTextColor(
  status: ConnectionVerifyStatus,
  privacy: ServerPrivacy
) {
  if (status === 'connected') {
    return PRIVACY_DOT_COLORS[privacy].live
  }
  return status === 'failed' ? Colors.mainRed : Colors.gray[400]
}
