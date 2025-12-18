import Clipboard from 'expo-clipboard'
import { useCallback } from 'react'
import { toast } from 'sonner-native'

import { t } from '@/locales'

type UseClipboardPasteParams = {
  onPaste?: (content: string) => void
  onError?: (error: string) => void
  onSuccess?: (content: string) => void
  validateContent?: (content: string) => { isValid: boolean; error?: string }
  trimContent?: boolean
  showToast?: boolean
}

type UseClipboardPasteReturn = {
  pasteFromClipboard: () => Promise<void>
  pasteFromClipboardWithValidation: (
    validator: (content: string) => { isValid: boolean; error?: string }
  ) => Promise<void>
  pasteFromClipboardSilent: () => Promise<string | null>
}

export function useClipboardPaste({
  onPaste,
  onError,
  onSuccess,
  validateContent,
  trimContent = true,
  showToast = true
}: UseClipboardPasteParams = {}): UseClipboardPasteReturn {
  const pasteFromClipboard = useCallback(async () => {
    try {
      const clipboardContent = await Clipboard.getStringAsync()

      if (!clipboardContent) {
        const errorMessage = t('watchonly.error.emptyClipboard')
        if (showToast) {
          toast.error(errorMessage)
        }
        onError?.(errorMessage)
        return
      }

      const finalContent = trimContent
        ? clipboardContent.trim()
        : clipboardContent

      // Validate content if validator provided
      if (validateContent) {
        const validation = validateContent(finalContent)
        if (!validation.isValid) {
          const errorMessage =
            validation.error || t('watchonly.error.clipboardPaste')
          if (showToast) {
            toast.error(errorMessage)
          }
          onError?.(errorMessage)
          return
        }
      }

      // Call the paste handler
      onPaste?.(finalContent)

      // Show success toast if enabled
      if (showToast) {
        toast.success(t('watchonly.success.clipboardPasted'))
      }

      // Call success callback
      onSuccess?.(finalContent)
    } catch (_error) {
      const errorMessage = t('watchonly.error.clipboardPaste')
      if (showToast) {
        toast.error(errorMessage)
      }
      onError?.(errorMessage)
    }
  }, [onPaste, onError, onSuccess, validateContent, trimContent, showToast])

  const pasteFromClipboardWithValidation = useCallback(
    async (
      validator: (content: string) => { isValid: boolean; error?: string }
    ) => {
      try {
        const clipboardContent = await Clipboard.getStringAsync()

        if (!clipboardContent) {
          const errorMessage = t('watchonly.error.emptyClipboard')
          if (showToast) {
            toast.error(errorMessage)
          }
          onError?.(errorMessage)
          return
        }

        const finalContent = trimContent
          ? clipboardContent.trim()
          : clipboardContent

        // Validate content with provided validator
        const validation = validator(finalContent)
        if (!validation.isValid) {
          const errorMessage =
            validation.error || t('watchonly.error.clipboardPaste')
          if (showToast) {
            toast.error(errorMessage)
          }
          onError?.(errorMessage)
          return
        }

        // Call the paste handler
        onPaste?.(finalContent)

        // Show success toast if enabled
        if (showToast) {
          toast.success(t('watchonly.success.clipboardPasted'))
        }

        // Call success callback
        onSuccess?.(finalContent)
      } catch (_error) {
        const errorMessage = t('watchonly.error.clipboardPaste')
        if (showToast) {
          toast.error(errorMessage)
        }
        onError?.(errorMessage)
      }
    },
    [onPaste, onError, onSuccess, trimContent, showToast]
  )

  const pasteFromClipboardSilent = useCallback(async (): Promise<
    string | null
  > => {
    try {
      const clipboardContent = await Clipboard.getStringAsync()

      if (!clipboardContent) {
        return null
      }

      return trimContent ? clipboardContent.trim() : clipboardContent
    } catch {
      return null
    }
  }, [trimContent])

  return {
    pasteFromClipboard,
    pasteFromClipboardWithValidation,
    pasteFromClipboardSilent
  }
}
