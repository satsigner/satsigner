import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

type SSExplorerCapabilityBannerProps = {
  why: string
  fix: string
  onLoad: () => void
  loading?: boolean
  loadLabel?: string
  note?: string
  disabled?: boolean
}

function SSExplorerCapabilityBanner({
  why,
  fix,
  onLoad,
  loading = false,
  loadLabel = t('explorer.capability.loadMempool'),
  note = t('explorer.capability.externalNote'),
  disabled = false
}: SSExplorerCapabilityBannerProps) {
  return (
    <SSVStack gap="sm" style={styles.container}>
      <SSText size="sm" color="muted">
        {why}
      </SSText>
      <SSText size="xs" color="muted">
        {fix}
      </SSText>
      <SSButton
        variant="outline"
        label={loadLabel}
        onPress={onLoad}
        loading={loading}
        disabled={disabled || loading}
      />
      <SSText size="xxs" center color="muted">
        {note}
      </SSText>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    borderColor: Colors.gray[800],
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  }
})

export default SSExplorerCapabilityBanner
