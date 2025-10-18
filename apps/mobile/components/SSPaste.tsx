import { useEffect, useState } from 'react'
import { AppState, StyleSheet, View } from 'react-native'
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
import { type DetectedContent } from '@/utils/contentDetector'

type SSPasteProps = {
  visible: boolean
  onClose: () => void
  onContentPasted: (content: DetectedContent) => void
  context: 'bitcoin' | 'lightning' | 'ecash'
}

function SSPaste({ visible, onClose, onContentPasted, context }: SSPasteProps) {
  const [content, setContent] = useState<string>('')
  const [isValidContent, setIsValidContent] = useState<boolean>(false)

  // Load clipboard content when modal opens
  useEffect(() => {
    if (visible) {
      loadClipboardContent()
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

  // Validate content when it changes
  useEffect(() => {
    if (content.trim()) {
      validateContent(content)
    } else {
      setIsValidContent(false)
    }
  }, [content, context])

  const loadClipboardContent = async () => {
    try {
      const text = await getAllClipboardContent()
      setContent(text || '')
    } catch (error) {
      console.error(t('paste.error.loadFailed'), error)
    }
  }

  const validateContent = async (text: string) => {
    try {
      const { detectContentByContext } = await import('@/utils/contentDetector')
      const detectedContent = detectContentByContext(text, context)
      setIsValidContent(detectedContent.isValid)
    } catch (error) {
      console.error(t('paste.error.validateFailed'), error)
      setIsValidContent(false)
    }
  }

  const handlePaste = async () => {
    if (!content.trim()) {
      toast.error(t('paste.error.noContent'))
      return
    }

    try {
      const { detectContentByContext } = await import('@/utils/contentDetector')
      const detectedContent = detectContentByContext(content, context)

      if (!detectedContent.isValid) {
        toast.error(t('paste.error.invalidContent'))
        return
      }

      onClose()
      onContentPasted(detectedContent)
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('paste.error.failed'))
      }
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

    if (isValidContent) {
      return t('paste.validation.valid')
    } else {
      return t('paste.validation.invalid')
    }
  }

  const getButtonLabel = () => {
    if (!content.trim()) {
      return t('paste.button.default')
    }

    if (isValidContent) {
      switch (context) {
        case 'bitcoin':
          if (content.includes('psbt')) {
            return t('paste.button.signPsbt')
          } else if (content.startsWith('bitcoin:')) {
            return t('paste.button.sendToAddress')
          } else {
            return t('paste.button.sendToAddress')
          }
        case 'lightning':
          if (content.startsWith('lnbc') || content.startsWith('lntb')) {
            return t('paste.button.payInvoice')
          } else if (content.startsWith('lnurl')) {
            return t('paste.button.processLnurl')
          } else {
            return t('paste.button.processLightning')
          }
        case 'ecash':
          if (content.startsWith('cashuA') || content.startsWith('cashuB')) {
            return t('paste.button.processEcashToken')
          } else if (content.startsWith('lnbc') || content.startsWith('lntb')) {
            return t('paste.button.payLightningInvoice')
          } else if (content.startsWith('lnurl')) {
            return t('paste.button.processLnurl')
          } else {
            return t('paste.button.processContent')
          }
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
            onPress={handlePaste}
          />
        </SSHStack>
      </SSVStack>
    </SSModal>
  )
}

export default SSPaste
