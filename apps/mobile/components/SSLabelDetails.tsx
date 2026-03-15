import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { parseLabel } from '@/utils/parse'

import { SSIconEditPencil } from './icons'
import SSIconButton from './SSIconButton'
import SSText from './SSText'

type SSLabelDetailsProps = {
  label: string
  link: string
  header: string
  privacyMode?: boolean
}

function SSLabelDetails({
  label: originalLabel,
  link,
  header,
  privacyMode = false
}: SSLabelDetailsProps) {
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    const { label, tags } = parseLabel(originalLabel)
    setLabel(label)
    setTags(tags)
  }, [originalLabel])

  return (
    <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
      <SSVStack gap="sm" style={{ maxWidth: '80%' }}>
        <SSText uppercase color="muted">
          {header}
        </SSText>
        {label && <SSText size="2xl">{privacyMode ? '••••' : label}</SSText>}
        {!label && (
          <SSText color="muted">
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
        <SSIconEditPencil height={20} width={20} />
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
