import { StyleSheet } from 'react-native'

import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSText from '@/components/SSText'
import { type ConnectionVerifyStatus } from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import { tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import { type ServerPrivacy } from '@/utils/serverPrivacy'
import {
  SERVER_STATUS_LABEL_KEYS,
  serverStatusTextColor
} from '@/utils/serverStatusDisplay'

const tn = _tn('settings.network.server')

const DOT_SIZE = 16

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
    <SSHStack gap="none" style={styles.row}>
      <SSConnectionStatusIndicator
        isOnion={isOnion}
        privacy={privacy}
        size={DOT_SIZE}
        status={status ?? 'idle'}
      />
      <SSText size="xs" style={styles.privacy}>
        {tn(`privacy.${privacy}`)}
      </SSText>
      {status && (
        <SSText
          size="xs"
          style={{ color: serverStatusTextColor(status, privacy) }}
        >
          {` · ${tn(SERVER_STATUS_LABEL_KEYS[status])}`}
        </SSText>
      )}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  privacy: {
    color: Colors.gray[200]
  },
  row: {
    alignItems: 'center'
  }
})

export default SSServerStatusLabel
