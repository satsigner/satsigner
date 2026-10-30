import { useState } from 'react'
import { toast } from 'sonner-native'

import { pickImageForUpload, uploadToBlossom } from '@/api/blossom'
import { t } from '@/locales'

async function uploadToBlossomWithToast(
  params: Parameters<typeof uploadToBlossom>[0]
) {
  try {
    const url = await uploadToBlossom(params)
    toast.success(t('nostrIdentity.profile.uploadSuccess'))
    return url
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t('nostrIdentity.profile.uploadError')
    toast.error(`${t('nostrIdentity.profile.uploadError')}: ${message}`)
    return null
  }
}

function useBlossomImageUpload(nsec: string) {
  const [isUploading, setIsUploading] = useState(false)

  async function upload(serverUrl: string): Promise<string | null> {
    const picked = await pickImageForUpload()
    if (!picked) {
      return null
    }

    setIsUploading(true)
    const url = await uploadToBlossomWithToast({
      fileUri: picked.uri,
      mimeType: picked.mimeType,
      nsec,
      serverUrl
    })
    setIsUploading(false)
    return url
  }

  return { isUploading, upload }
}

export default useBlossomImageUpload
