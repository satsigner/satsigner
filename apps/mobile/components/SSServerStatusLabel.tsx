import SSConnectionStatusIndicator, {
  statusColor
} from '@/components/SSConnectionStatusIndicator'
import SSText from '@/components/SSText'
import { type ConnectionVerifyStatus } from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import { tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import { type ServerPrivacy } from '@/utils/serverPrivacy'

const tn = _tn('settings.network.server')

const STATUS_LABEL_KEYS: Record<ConnectionVerifyStatus, string> = {
  checking: 'status.checking',
  connected: 'status.connected',
  failed: 'status.unreachable',
  idle: 'status.idle'
}

const DOT_SIZE = 16

// The muted dot shades are too dark to read as text.
function statusTextColor(
  status: ConnectionVerifyStatus,
  privacy: ServerPrivacy
) {
  if (status === 'connected') {
    return statusColor(status, privacy)
  }
  return status === 'failed' ? Colors.mainRed : Colors.gray[400]
}

type SSServerStatusLabelProps = {
  isOnion: boolean
  privacy: ServerPrivacy
  /** Live status of the active server; omitted for servers not in use. */
  status?: ConnectionVerifyStatus
}

function SSServerStatusLabel({
  isOnion,
  privacy,
  status
}: SSServerStatusLabelProps) {
  return (
    <SSHStack gap="none" style={{ alignItems: 'center' }}>
      <SSConnectionStatusIndicator
        isOnion={isOnion}
        privacy={privacy}
        size={DOT_SIZE}
        status={status ?? 'idle'}
      />
      <SSText size="xs" style={{ color: Colors.gray[200] }}>
        {tn(`privacy.${privacy}`)}
      </SSText>
      {status && (
        <SSText size="xs" style={{ color: statusTextColor(status, privacy) }}>
          {` · ${tn(STATUS_LABEL_KEYS[status])}`}
        </SSText>
      )}
    </SSHStack>
  )
}

export default SSServerStatusLabel
