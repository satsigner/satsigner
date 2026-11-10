import { StyleSheet } from 'react-native'

import SSConnectionStatusIndicator from '@/components/SSConnectionStatusIndicator'
import SSText from '@/components/SSText'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

type SSBackendSourceLabelProps = {
  label: string
  /** Data came from mempool.space instead of the configured backend. */
  isExternal?: boolean
  mono?: boolean
}

type LiveBackendLabelProps = {
  label: string
  mono: boolean
}

const DOT_SIZE = 14

function LiveBackendLabel({ label, mono }: LiveBackendLabelProps) {
  const [status, , privacy, { isOnion }] = useVerifyConnection()

  return (
    <SSHStack gap="none" style={styles.row}>
      <SSConnectionStatusIndicator
        isOnion={isOnion}
        privacy={privacy}
        size={DOT_SIZE}
        status={status}
      />
      <SSText
        size="xxs"
        type={mono ? 'mono' : undefined}
        style={styles.backend}
      >
        {label}
      </SSText>
    </SSHStack>
  )
}

/**
 * Names where explorer data came from. For the configured backend it shows
 * the live connection dot (privacy color, dimmed when not connected) instead
 * of always-green text, which read as "connected" even when it wasn't.
 */
function SSBackendSourceLabel({
  label,
  isExternal = false,
  mono = false
}: SSBackendSourceLabelProps) {
  if (isExternal) {
    return (
      <SSText
        size="xxs"
        type={mono ? 'mono' : undefined}
        style={styles.external}
      >
        {label}
      </SSText>
    )
  }

  return <LiveBackendLabel label={label} mono={mono} />
}

const styles = StyleSheet.create({
  backend: {
    color: Colors.gray[200]
  },
  external: {
    color: Colors.gray[500]
  },
  row: {
    alignItems: 'center',
    justifyContent: 'center'
  }
})

export default SSBackendSourceLabel
