import { useCallback, useEffect, useState } from 'react'
import { AppState, StyleSheet } from 'react-native'
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
import {
  type ContentType,
  detectContentByContext,
  type DetectedContent
} from '@/utils/contentDetector'

type SSPasteProps = {
  visible: boolean
  onClose: () => void
  onContentPasted: (content: DetectedContent) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
}

function SSPaste({ visible, onClose, onContentPasted, context }: SSPasteProps) {
  const [content, setContent] = useState('')
  const [isValidContent, setIsValidContent] = useState(false)
  const [detectedContentType, setDetectedContentType] =
    useState<ContentType | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (visible) {
      loadClipboardContent()
    } else {
      setContent('')
      setIsValidContent(false)
      setDetectedContentType(null)
      setIsProcessing(false)
    }
  }, [visible])

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
        // Strip "bitcoin:" prefix for validation but keep original for display
        let processedText = text
        if (
          processedText.toLowerCase().startsWith('bitcoin:') &&
          context === 'bitcoin'
        ) {
          processedText = processedText.substring(8)
        }
        const detectedContent = await detectContentByContext(
          processedText,
          context
        )
        if (detectedContent.type === 'incompatible') {
          toast.error(t('paste.error.incompatibleContent'))
          setIsValidContent(false)
          setDetectedContentType(null)
          return
        }
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

  useEffect(() => {
    if (content.trim()) {
      validateContent(content)
    } else {
      setIsValidContent(false)
      setDetectedContentType(null)
    }
  }, [content, context, validateContent])

  async function loadClipboardContent() {
    try {
      const text = await getAllClipboardContent()
      setContent(text || '')
    } catch {
      toast.error(t('paste.error.loadFailed'))
    }
  }

  async function handlePaste() {
    if (!content.trim()) {
      toast.error(t('paste.error.noContent'))
      return
    }

    try {
      setIsProcessing(true)

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Strip "bitcoin:" prefix for processing but keep original for display
      let processedContent = content
      if (
        processedContent.toLowerCase().startsWith('bitcoin:') &&
        context === 'bitcoin'
      ) {
        processedContent = processedContent.substring(8)
      }

      const detectedContent = await detectContentByContext(
        processedContent,
        context
      )

      if (!detectedContent.isValid) {
        setIsProcessing(false)
        toast.error(t('paste.error.invalidContent'))
        return
      }

      if (detectedContent.type === 'psbt') {
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

  function getContextTitle() {
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

  function getContextDescription() {
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

  function getValidationMessage() {
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

  function getButtonLabel() {
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
            style={[
              styles.textInput,
              {
                borderColor: content.trim()
                  ? isValidContent
                    ? Colors.success
                    : Colors.error
                  : Colors.gray[600]
              }
            ]}
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

const styles = StyleSheet.create({
  textInput: {
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
    borderRadius: 5,
    backgroundColor: Colors.gray[900]
  }
})

export default SSPaste
