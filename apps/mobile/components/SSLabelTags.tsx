import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { parseLabel } from '@/utils/parse'

import SSTagChip from './SSTagChip'
import SSText from './SSText'

type SSLabelTagsProps = {
  label?: string
  size?: 'xs' | 'xxs'
}

function SSLabelTags({ label = '', size = 'xs' }: SSLabelTagsProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const parsedLabel = parseLabel(label)

  if (parsedLabel.label === '' && parsedLabel.tags.length === 0) {
    return null
  }

  if (privacyMode) {
    return (
      <SSText size={size} style={styles.label}>
        ••••
      </SSText>
    )
  }

  return (
    <SSHStack gap="xs" style={styles.row}>
      {parsedLabel.label !== '' && (
        <SSText size={size} style={styles.label} numberOfLines={1}>
          {parsedLabel.label}
        </SSText>
      )}
      {parsedLabel.tags.map((tag) => (
        <SSTagChip key={tag} tag={tag} />
      ))}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  label: {
    color: Colors.gray[300],
    flexShrink: 1
  },
  row: {
    alignItems: 'center',
    flexWrap: 'wrap'
  }
})

export default SSLabelTags
