import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { getAllClipboardContent } from '@/utils/clipboard'
import { type ContentType, type DetectedContent } from '@/utils/contentDetector'

type SSPasteProps = {
  visible: boolean
  onClose: () => void
  onContentPasted: (content: DetectedContent) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
}

function SSPaste({ visible, onClose, onContentPasted, context }: SSPasteProps) {
  const [content, setContent] = useState<string>('')
  const [isValidContent, setIsValidContent] = useState<boolean>(false)
  const [detectedContentType, setDetectedContentType] =
    useState<ContentType | null>(null)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  // Load clipboard content when modal opens
  useEffect(() => {
    if (visible) {
      loadClipboardContent()
    } else {
      // Reset state when modal closes
      setContent('')
      setIsValidContent(false)
      setDetectedContentType(null)
      setIsProcessing(false)
    }
  }, [visible])

  // Monitor clipboard changes when app becomes active
  useEffect(() => {
    if (!visible) return

    const subscription = AppState.addEventListener(
      'change',
      async (nextAppState) => {
        if (nextAppState === 'active') {
          setTimeout(async () => {
            await loadClipboardContent()
          }, 1)
        }
      }
    )

    return () => {
      subscription.remove()
    }
  }, [visible])

  const validateContent = useCallback(
    async (text: string) => {
      try {
        const { detectContentByContext } = await import(
          '@/utils/contentDetector'
        )
        const detectedContent = detectContentByContext(text, context)
        setIsValidContent(detectedContent.isValid)
        setDetectedContentType(
          detectedContent.isValid ? detectedContent.type : null
        )
      } catch {
        toast.error(t('paste.error.validateFailed'))
        setIsValidContent(false)
        setDetectedContentType(null)
      }
    },
    [context]
  )

  // Validate content when it changes
  useEffect(() => {
    if (content.trim()) {
      validateContent(content)
    } else {
      setIsValidContent(false)
      setDetectedContentType(null)
    }
  }, [content, context, validateContent])

  const loadClipboardContent = async () => {
    try {
      const text = await getAllClipboardContent()
      setContent(text || '')
    } catch {
      toast.error(t('paste.error.loadFailed'))
    }
  }

  const handlePaste = async () => {
    if (!content.trim()) {
      toast.error(t('paste.error.noContent'))
      return
    }

    try {
      setIsProcessing(true)

      // Small delay to ensure loading state is visible
      await new Promise((resolve) => setTimeout(resolve, 100))

      const { detectContentByContext } = await import('@/utils/contentDetector')
      const detectedContent = detectContentByContext(content, context)

      if (!detectedContent.isValid) {
        setIsProcessing(false)
        toast.error(t('paste.error.invalidContent'))
        return
      }

      // For PSBT, navigation happens immediately, so close modal after showing loading
      if (detectedContent.type === 'psbt') {
        // Keep loading visible briefly, then close modal
        setTimeout(() => {
          onClose()
          setIsProcessing(false)
        }, 300)
      } else {
        setIsProcessing(false)
      }

      onContentPasted(detectedContent)
    } catch {
      setIsProcessing(false)
      toast.error(t('paste.error.failed'))
    }
  }

  const getContextTitle = () => {
    switch (context) {
      case 'bitcoin':
        return t('paste.title.bitcoin')
      case 'lightning':
        return t('paste.title.lightning')
      case 'ecash':
        return t('paste.title.ecash')
      default:
        return t('paste.title.default')
    }
  }

  const getContextDescription = () => {
    switch (context) {
      case 'bitcoin':
        return t('paste.description.bitcoin')
      case 'lightning':
        return t('paste.description.lightning')
      case 'ecash':
        return t('paste.description.ecash')
      default:
        return t('paste.description.default')
    }
  }

  const getValidationMessage = () => {
    if (!content.trim()) {
      return t('paste.validation.empty')
    }

    if (isValidContent && detectedContentType) {
      const contentTypeKey = `paste.validation.${detectedContentType}`
      const fallbackKey = 'paste.validation.valid'
      return t(contentTypeKey) || t(fallbackKey)
    } else {
      return t('paste.validation.invalid')
    }
  }

  const getButtonLabel = () => {
    if (!content.trim()) {
      return t('paste.button.default')
    }

    if (isValidContent && detectedContentType) {
      switch (detectedContentType) {
        case 'psbt':
          return t('paste.button.previewPsbt')
        case 'bitcoin_address':
        case 'bitcoin_uri':
          return t('paste.button.sendToAddress')
        case 'bitcoin_transaction':
          return t('paste.button.processTransaction')
        case 'lightning_invoice':
          if (context === 'ecash') {
            return t('paste.button.payLightningInvoice')
          }
          return t('paste.button.payInvoice')
        case 'lnurl':
          return t('paste.button.processLnurl')
        case 'ecash_token':
          return t('paste.button.processEcashToken')
        case 'bbqr_fragment':
          return t('paste.button.processBBQR')
        case 'seed_qr':
          return t('paste.button.processSeed')
        case 'ur':
          return t('paste.button.processUR')
        default:
          return t('paste.button.processContent')
      }
    } else {
      return t('paste.button.default')
    }
  }

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack
        justifyBetween
        style={{ height: '100%', paddingHorizontal: 20 }}
      >
        <SSVStack itemsCenter gap="md" style={{ width: '100%' }}>
          <SSText center uppercase>
            {getContextTitle()}
          </SSText>

          <SSText center color="muted" size="sm" style={{ maxWidth: 280 }}>
            {getContextDescription()}
          </SSText>

          <SSText
            center
            color={
              content.trim() ? (isValidContent ? 'white' : 'muted') : 'muted'
            }
            size="sm"
            style={{ maxWidth: 280 }}
          >
            {getValidationMessage()}
          </SSText>
          <SSTextInput
            value={content}
            onChangeText={setContent}
            placeholder={getContextDescription()}
            multiline
            numberOfLines={20}
            style={{
              minHeight: 200,
              maxHeight: 400,
              height: 'auto',
              width: '100%',
              maxWidth: 320,
              textAlign: 'left',
              fontSize: 14,
              letterSpacing: 0.5,
              fontFamily: 'monospace',
              borderWidth: 1,
              padding: 10,
              borderColor: content.trim()
                ? isValidContent
                  ? Colors.success
                  : Colors.error
                : Colors.gray[600],
              borderRadius: 5,
              backgroundColor: Colors.gray[900]
            }}
            textAlignVertical="top"
          />
        </SSVStack>
        <SSHStack gap="sm" style={{ width: '100%' }}>
          <SSButton
            variant={isValidContent ? 'default' : 'secondary'}
            label={getButtonLabel()}
            disabled={!isValidContent}
            loading={isProcessing}
            onPress={handlePaste}
          />
        </SSHStack>
      </SSVStack>
    </SSModal>
  )
}

export default SSPaste
