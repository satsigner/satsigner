import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSMintSelectorProps = {
  selectedMintUrl?: string
  onMintSelect: (mintUrl: string) => void
  style?: any
}

export default function SSMintSelector({
  selectedMintUrl,
  onMintSelect,
  style
}: SSMintSelectorProps) {
  const { mints } = useEcash()

  if (mints.length === 0) {
    return (
      <SSVStack style={[styles.container, style]}>
        <SSText color="muted" center>
          No mint connected
        </SSText>
        <SSText color="muted" size="sm" center>
          Connect to a mint first
        </SSText>
      </SSVStack>
    )
  }

  // With single mint limitation, we only show the connected mint
  const mint = mints[0]
  return (
    <SSVStack style={[styles.container, style]}>
      <SSText color="muted" uppercase>
        Connected Mint
      </SSText>
      <SSText weight="medium">{mint.name || mint.url}</SSText>
      <SSText color="muted" size="sm">
        {mint.url}
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16
  },
  mintButton: {
    marginVertical: 4
  }
})
