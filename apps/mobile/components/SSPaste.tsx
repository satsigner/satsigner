import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AppState,
  Keyboard,
  StyleSheet,
  type TextInput as RNTextInput
} from 'react-native'
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
  type ContentContext,
  type ContentType,
  detectContentByContext,
  type DetectedContent
} from '@/utils/contentDetector'
import { stripBitcoinPrefix } from '@/utils/parse'

type SSPasteProps = {
  visible: boolean
  onClose: () => void
  onContentPasted: (content: DetectedContent) => void
  context: ContentContext
}

function SSPaste({ visible, onClose, onContentPasted, context }: SSPasteProps) {
  const inputRef = useRef<RNTextInput>(null)
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
    if (!visible) {
      return
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setTimeout(async () => {
          await loadClipboardContent()
        }, 1)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [visible])

  const validateContent = useCallback(
    async (text: string) => {
      try {
        const processedText =
          context === 'bitcoin' ? stripBitcoinPrefix(text) : text
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

      await new Promise((resolve) => {
        setTimeout(resolve, 100)
      })

      const processedContent =
        context === 'bitcoin' ? stripBitcoinPrefix(content) : content

      const detectedContent = await detectContentByContext(
        processedContent,
        context
      )

      if (!detectedContent.isValid) {
        setIsProcessing(false)
        toast.error(t('paste.error.invalidContent'))
        return
      }

      const autoCloseTypes = [
        'psbt',
        'nostr_npub',
        'nostr_nsec',
        'nostr_note',
        'nostr_nevent',
        'nostr_nprofile',
        'nostr_json'
      ]

      if (autoCloseTypes.includes(detectedContent.type)) {
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
      case 'nostr':
        return t('paste.title.nostr')
      case 'ark':
        return t('paste.title.ark')
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
      case 'nostr':
        return t('paste.description.nostr')
      case 'ark':
        return t('paste.description.ark')
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
    }
    return t('paste.validation.invalid')
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
        case 'ark_address':
          return t('paste.button.sendToArk')
        case 'lightning_address':
          return t('paste.button.payLightningAddress')
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
        case 'nostr_note':
        case 'nostr_nevent':
          return t('paste.button.loadNote')
        case 'nostr_npub':
        case 'nostr_nprofile':
          return t('paste.button.loadProfile')
        case 'nostr_nsec':
        case 'nostr_json':
          return t('paste.button.processNostr')
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
            ref={inputRef}
            value={content}
            onChangeText={setContent}
            placeholder={getContextDescription()}
            multiline
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss()
              inputRef.current?.blur()
            }}
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
    backgroundColor: Colors.gray[900],
    borderRadius: 5,
    borderWidth: 1,
    fontFamily: 'monospace',
    fontSize: 14,
    height: 'auto',
    letterSpacing: 0.5,
    maxHeight: 400,
    maxWidth: 320,
    minHeight: 200,
    padding: 10,
    textAlign: 'left',
    width: '100%'
  }
})

export default SSPaste
