import { useState } from 'react'
import { toast } from 'sonner-native'

import { pickImageForUpload, uploadToBlossom } from '@/api/blossom'
import { t } from '@/locales'

function useBlossomImageUpload(nsec: string) {
  const [isUploading, setIsUploading] = useState(false)

  async function upload(serverUrl: string): Promise<string | null> {
    const picked = await pickImageForUpload()
    if (!picked) {
      return null
    }

    setIsUploading(true)
    try {
      const url = await uploadToBlossom({
        fileUri: picked.uri,
        mimeType: picked.mimeType,
        nsec,
        serverUrl
      })
      return url
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('nostrIdentity.profile.uploadError')
      toast.error(`${t('nostrIdentity.profile.uploadError')}: ${message}`)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  return { isUploading, upload }
}

export default useBlossomImageUpload
