import { Share } from 'react-native'

import { shareExistingFile } from '@/utils/filesystem'

type ShareTextProps = {
  content: string
  dialogTitle?: string
}

export async function shareText({
  content,
  dialogTitle
}: ShareTextProps): Promise<void> {
  try {
    await Share.share(
      { message: content },
      dialogTitle ? { dialogTitle } : undefined
    )
  } catch {
    /* sharing cancelled or unavailable — silently ignored */
  }
}

type ShareImageProps = {
  uri: string
  dialogTitle: string
  mimeType?: string
}

export async function shareImage({
  uri,
  dialogTitle,
  mimeType = 'image/png'
}: ShareImageProps): Promise<void> {
  try {
    await shareExistingFile({ dialogTitle, fileUri: uri, mimeType })
  } catch {
    /* sharing cancelled or unavailable — silently ignored */
  }
}
