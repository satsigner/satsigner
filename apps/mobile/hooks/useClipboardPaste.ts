import * as Clipboard from 'expo-clipboard'
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

async function pasteClipboardContent({
  onPaste,
  onError,
  onSuccess,
  validateContent,
  trimContent,
  showToast
}: UseClipboardPasteParams) {
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

    onPaste?.(finalContent)

    if (showToast) {
      toast.success(t('watchonly.success.clipboardPasted'))
    }

    onSuccess?.(finalContent)
  } catch {
    const errorMessage = t('watchonly.error.clipboardPaste')
    if (showToast) {
      toast.error(errorMessage)
    }
    onError?.(errorMessage)
  }
}

async function readClipboardContent(
  trimContent: boolean
): Promise<string | null> {
  try {
    const clipboardContent = await Clipboard.getStringAsync()

    if (!clipboardContent) {
      return null
    }

    return trimContent ? clipboardContent.trim() : clipboardContent
  } catch {
    return null
  }
}

export function useClipboardPaste({
  onPaste,
  onError,
  onSuccess,
  validateContent,
  trimContent = true,
  showToast = true
}: UseClipboardPasteParams = {}): UseClipboardPasteReturn {
  const pasteFromClipboard = useCallback(
    () =>
      pasteClipboardContent({
        onError,
        onPaste,
        onSuccess,
        showToast,
        trimContent,
        validateContent
      }),
    [onPaste, onError, onSuccess, validateContent, trimContent, showToast]
  )

  const pasteFromClipboardWithValidation = useCallback(
    (validator: (content: string) => { isValid: boolean; error?: string }) =>
      pasteClipboardContent({
        onError,
        onPaste,
        onSuccess,
        showToast,
        trimContent,
        validateContent: validator
      }),
    [onPaste, onError, onSuccess, trimContent, showToast]
  )

  const pasteFromClipboardSilent = useCallback(
    () => readClipboardContent(trimContent),
    [trimContent]
  )

  return {
    pasteFromClipboard,
    pasteFromClipboardSilent,
    pasteFromClipboardWithValidation
  }
}
