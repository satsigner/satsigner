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
  const hasLabel = !!label
  const hasTags = !privacyMode && tags.length > 0
  const showEmptyPlaceholders = !privacyMode && !hasLabel && !hasTags

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={header}
      onPress={() => openLabelEditor(link)}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <SSHStack justifyBetween style={styles.row}>
        <SSVStack gap="xxs" style={styles.content}>
          <SSText uppercase color="muted" size="xs">
            {header}
          </SSText>
          {showEmptyPlaceholders ? (
            <SSHStack gap="sm" style={styles.placeholders}>
              <SSText size="sm" weight="light" style={styles.placeholder}>
                {t('transaction.noLabel')}
              </SSText>
              <SSText size="sm" weight="light" style={styles.placeholderDot}>
                ·
              </SSText>
              <SSText size="sm" weight="light" style={styles.placeholder}>
                {t('transaction.noTags')}
              </SSText>
            </SSHStack>
          ) : (
            <SSHStack gap="sm" style={styles.body}>
              {hasLabel || privacyMode ? (
                <SSText size={getLabelTextSize(label || '••••')} weight="light">
                  {privacyMode ? '••••' : label}
                </SSText>
              ) : (
                <SSText size="sm" weight="light" style={styles.placeholder}>
                  {t('transaction.noLabel')}
                </SSText>
              )}
              {hasTags
                ? tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <SSText
                        size="xs"
                        uppercase={false}
                        style={styles.tagText}
                      >
                        {tag}
                      </SSText>
                    </View>
                  ))
                : null}
            </SSHStack>
          )}
        </SSVStack>
        <SSIconEditPencil height={16} width={16} strokeWidth={0.75} />
      </SSHStack>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  content: {
    flex: 1,
    maxWidth: '80%'
  },
  placeholder: {
    color: Colors.gray[500]
  },
  placeholderDot: {
    color: Colors.gray[600]
  },
  placeholders: {
    alignItems: 'center'
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
    alignSelf: 'center',
    backgroundColor: Colors.gray[700],
    borderCurve: 'continuous',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  tagText: {
    color: Colors.white
  }
})

export default SSLabelDetails
