import {
  SSIconBlackIndicator,
  SSIconGreenIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

type SSConnectionTestResultsProps = {
  testing: boolean
  connectionState: boolean
  connectionString: string
  isPrivateConnection: boolean
  nodeInfo?: {
    software?: string
    version?: string
    responseTime?: number
    network?: string
    blockHeight?: number
    mempoolSize?: number
    medianFee?: number
  }
}

function SSConnectionTestResults({
  testing,
  connectionState,
  connectionString,
  isPrivateConnection,
  nodeInfo
}: SSConnectionTestResultsProps) {
  if (!testing) return null

  return (
    <SSVStack gap="md" style={{ marginBottom: 24 }}>
      <SSHStack style={{ justifyContent: 'center', gap: 0 }}>
        {connectionState ? (
          isPrivateConnection ? (
            <SSIconYellowIndicator height={24} width={24} />
          ) : (
            <SSIconGreenIndicator height={24} width={24} />
          )
        ) : (
          <SSIconBlackIndicator height={24} width={24} />
        )}
        <SSText
          size="xxs"
          uppercase
          style={{
            color: connectionState ? Colors.gray['200'] : Colors.gray['450']
          }}
        >
          {connectionString}
        </SSText>
      </SSHStack>

      {testing && !connectionState && !nodeInfo && (
        <SSVStack gap="sm" style={{ paddingTop: 16 }}>
          <SSText size="sm" color="muted" center>
            Testing connection...
          </SSText>
        </SSVStack>
      )}

      {connectionState && nodeInfo && (
        <SSVStack gap="sm" style={{ paddingTop: 16 }}>
          <SSHStack justifyBetween>
            <SSText size="sm" color="muted">
              Software
            </SSText>
            <SSText size="sm">{nodeInfo.software || 'Unknown'}</SSText>
          </SSHStack>

          {nodeInfo.version && (
            <SSHStack justifyBetween>
              <SSText size="sm" color="muted">
                Version
              </SSText>
              <SSText size="sm">{nodeInfo.version}</SSText>
            </SSHStack>
          )}

          <SSHStack justifyBetween>
            <SSText size="sm" color="muted">
              Response Time
            </SSText>
            <SSText size="sm">{nodeInfo.responseTime || 0}ms</SSText>
          </SSHStack>

          <SSHStack justifyBetween>
            <SSText size="sm" color="muted">
              Network
            </SSText>
            <SSText size="sm" style={{ textTransform: 'capitalize' }}>
              {nodeInfo.network || 'Unknown'}
            </SSText>
          </SSHStack>

          <SSHStack justifyBetween>
            <SSText size="sm" color="muted">
              Block Height
            </SSText>
            <SSText size="sm">{nodeInfo.blockHeight?.toLocaleString()}</SSText>
          </SSHStack>

          {nodeInfo.mempoolSize !== undefined && (
            <SSHStack justifyBetween>
              <SSText size="sm" color="muted">
                Mempool Size
              </SSText>
              <SSText size="sm">
                {nodeInfo.mempoolSize.toLocaleString()} txs
              </SSText>
            </SSHStack>
          )}

          {nodeInfo.medianFee !== undefined && (
            <SSHStack justifyBetween>
              <SSText size="sm" color="muted">
                Fee Rate (6 blocks)
              </SSText>
              <SSText size="sm">{nodeInfo.medianFee} sat/vB</SSText>
            </SSHStack>
          )}
        </SSVStack>
      )}
    </SSVStack>
  )
}

export default SSConnectionTestResults
