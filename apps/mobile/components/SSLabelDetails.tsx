import { router, type Href } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { getLabelTextSize } from '@/utils/label'
import { parseLabel } from '@/utils/parse'

import { SSIconEditPencil } from './icons'
import SSText from './SSText'

type SSLabelDetailsProps = {
  label: string
  link: Href
  header: string
  privacyMode?: boolean
}

function openLabelEditor(link: Href) {
  router.navigate(link)
}

function SSLabelDetails({
  label: originalLabel,
  link,
  header,
  privacyMode = false
}: SSLabelDetailsProps) {
  const { label, tags } = parseLabel(originalLabel)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={header}
      onPress={() => openLabelEditor(link)}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <SSHStack justifyBetween style={styles.row}>
        <SSVStack gap="sm" style={styles.content}>
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
          {!privacyMode && tags.length > 0 ? (
            <SSHStack gap="sm">
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <SSText size="xs" uppercase={false} style={styles.tagText}>
                    {tag}
                  </SSText>
                </View>
              ))}
            </SSHStack>
          ) : null}
          {!privacyMode && tags.length === 0 ? (
            <SSText color="muted">{t('transaction.noTags')}</SSText>
          ) : null}
        </SSVStack>
        <SSIconEditPencil height={16} width={16} strokeWidth={0.75} />
      </SSHStack>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    maxWidth: '80%'
  },
  pressable: {
    width: '100%'
  },
  pressed: {
    opacity: 0.7
  },
  row: {
    alignItems: 'flex-start'
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.gray[700],
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  tagText: {
    color: Colors.white
  }
})

export default SSLabelDetails
