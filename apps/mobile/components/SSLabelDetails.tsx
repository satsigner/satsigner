import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import SSText from './SSText'
import { useEffect, useState } from 'react'
import SSButton from './SSButton'
import SSIconButton from './SSIconButton'
import { router } from 'expo-router'
import { SSIconEditPencil } from './icons'
import { i18n } from '@/locales'
import { formatLabel } from '@/utils/format'
import { Colors } from '@/styles'

type SSLabelDetailsProps = {
  label: string
  link: string
  header: string
}

export function SSLabelDetails({
  label: originalLabel,
  link,
  header
}: SSLabelDetailsProps) {
  const [label, setLabel] = useState('')
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    const { label, tags } = formatLabel(originalLabel)
    setLabel(label)
    setTags(tags)
  }, [originalLabel])

  return (
    <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
      <SSVStack gap="sm">
        <SSText uppercase size="md" weight="bold">
          {header}
        </SSText>
        {label && <SSText>{label}</SSText>}
        {tags.length > 0 && (
          <SSHStack gap="sm">
            {tags.map((tag) => (
              <SSButton
                key={tag}
                label={tag}
                uppercase={false}
                style={{
                  backgroundColor: Colors.gray[700],
                  borderStyle: 'solid',
                  paddingHorizontal: 8,
                  height: 'auto',
                  width: 'auto'
                }}
              />
            ))}
          </SSHStack>
        )}
        {!label && <SSText color="muted">{i18n.t('account.noLabel')}</SSText>}
        {tags.length === 0 && (
          <SSText color="muted">{i18n.t('account.noTags')}</SSText>
        )}
      </SSVStack>
      <SSIconButton onPress={() => router.navigate(link)}>
        <SSIconEditPencil height={20} width={20} />
      </SSIconButton>
    </SSHStack>
  )
}
