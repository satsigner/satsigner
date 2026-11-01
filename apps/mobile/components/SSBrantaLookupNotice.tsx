import SSText from '@/components/SSText'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type BrantaLookupNotice } from '@/types/models/Branta'

type SSBrantaLookupNoticeProps = {
  notice: BrantaLookupNotice | null
}

function SSBrantaLookupNotice({ notice }: SSBrantaLookupNoticeProps) {
  if (!notice) {
    return null
  }

  const message = {
    incomplete: t('settings.branta.incomplete'),
    tampered: t('settings.branta.tampered'),
    unavailable: t('settings.branta.unavailable')
  }[notice]

  return (
    <SSText
      size="xs"
      style={{ color: notice === 'tampered' ? Colors.error : Colors.warning }}
    >
      {message}
    </SSText>
  )
}

export default SSBrantaLookupNotice
