import { router, type Href } from 'expo-router'
import { Pressable, StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type TextFontSize } from '@/styles/sizes'
import { parseLabel } from '@/utils/parse'

import { SSIconEditPencil } from './icons'
import SSIconButton from './SSIconButton'
import SSText from './SSText'

type SSLabelDetailsProps = {
  label: string
  link: Href
  header: string
  privacyMode?: boolean
}

function getLabelTextSize(label: string): TextFontSize {
  if (label.length > 48) {
    return 'sm'
  }
  if (label.length > 32) {
    return 'md'
  }
  if (label.length > 20) {
    return 'lg'
  }
  return 'xl'
}

function SSLabelDetails({
  label: originalLabel,
  link,
  header,
  privacyMode = false
}: SSLabelDetailsProps) {
  const { label, tags } = parseLabel(originalLabel)

  return (
    <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
      <SSVStack gap="sm" style={{ maxWidth: '80%' }}>
        <SSText uppercase color="muted">
          {header}
        </SSText>
        {label ? (
          <SSText size={getLabelTextSize(label)} weight="light">
            {privacyMode ? '••••' : label}
          </SSText>
        ) : (
          <SSText color="muted" weight="light">
            {privacyMode ? '••••' : t('transaction.noLabel')}
          </SSText>
        )}
        {!privacyMode && tags.length > 0 && (
          <SSHStack gap="sm">
            {tags.map((tag) => (
              <Pressable
                key={tag}
                style={({ pressed }) => [
                  styles.tag,
                  pressed && styles.tagPressed
                ]}
              >
                <SSText size="xs" uppercase={false} style={styles.tagText}>
                  {tag}
                </SSText>
              </Pressable>
            ))}
          </SSHStack>
        )}
        {!privacyMode && tags.length === 0 && (
          <SSText color="muted">{t('transaction.noTags')}</SSText>
        )}
      </SSVStack>
      <SSIconButton onPress={() => router.navigate(link)}>
        <SSIconEditPencil height={16} width={16} strokeWidth={0.75} />
      </SSIconButton>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[700],
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  tagPressed: {
    opacity: 0.8
  },
  tagText: {
    color: Colors.white
  }
})

export default SSLabelDetails
