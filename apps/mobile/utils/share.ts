import { type RefObject } from 'react'
import { Share, type View } from 'react-native'
import { captureRef } from 'react-native-view-shot'

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

type ShareViewAsImageProps = {
  viewRef: RefObject<View | null>
  dialogTitle: string
}

export async function shareViewAsImage({
  viewRef,
  dialogTitle
}: ShareViewAsImageProps): Promise<void> {
  if (!viewRef.current) {
    return
  }
  const uri = await captureRef(viewRef, { format: 'png', result: 'tmpfile' })
  try {
    await shareExistingFile({
      dialogTitle,
      fileUri: uri,
      mimeType: 'image/png'
    })
  } catch {
    /* sharing cancelled or unavailable — silently ignored */
  }
}
