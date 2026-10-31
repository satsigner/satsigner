import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { NostrDataSource, NostrErrorCode } from '@/types/models/Nostr'
import { getNostrErrorMessageForCode } from '@/utils/nostrErrorMessage'

type SSNostrSourceBannerProps = {
  error?: NostrErrorCode
  onRetry?: () => void
  retrying?: boolean
  source: NostrDataSource
}

function SSNostrSourceBanner({
  error,
  onRetry,
  retrying = false,
  source
}: SSNostrSourceBannerProps) {
  if (source === 'relay' && !error) {
    return null
  }

  const sourceLabel =
    source === 'relay' ? null : t(`nostrErrors.source.${source}`)

  return (
    <View style={styles.container}>
      {sourceLabel ? <SSText style={styles.text}>{sourceLabel}</SSText> : null}
      {error ? (
        <SSText size="xs" color="muted">
          {getNostrErrorMessageForCode(error)}
        </SSText>
      ) : null}
      {onRetry ? (
        <SSButton
          label={t('nostrErrors.source.retry')}
          loading={retrying}
          onPress={onRetry}
          variant="subtle"
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderColor: Colors.warning,
    borderRadius: 5,
    borderWidth: 1,
    gap: 8,
    padding: 10
  },
  text: {
    color: Colors.warning
  }
})

export default SSNostrSourceBanner
