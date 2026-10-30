import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  AppState,
  Keyboard,
  StyleSheet,
  TextInput,
  type TextInputInstance
} from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { getAllClipboardContent } from '@/utils/clipboard'
import {
  type ContentContext,
  type ContentType,
  detectContentByContext,
  type DetectedContent,
  preprocessByContext
} from '@/utils/contentDetector'

type SSPasteProps = {
  visible: boolean
  onClose: () => void
  onContentPasted: (content: DetectedContent) => void
  context: ContentContext
}

type PasteValidationError = 'failed' | 'incompatible'

type PasteValidation = {
  error: PasteValidationError | null
  validContentType: ContentType | null
}

const EMPTY_PASTE_VALIDATION: PasteValidation = {
  error: null,
  validContentType: null
}

const PASTE_VALIDATION_ERROR_KEY: Record<PasteValidationError, string> = {
  failed: 'paste.error.validateFailed',
  incompatible: 'paste.error.incompatibleContent'
}

async function readClipboardText() {
  return (await getAllClipboardContent()) || ''
}

function validatePasteContent(
  text: string,
  context: ContentContext
): PasteValidation {
  if (!text.trim()) {
    return EMPTY_PASTE_VALIDATION
  }
  try {
    const processedText = preprocessByContext(text, context)
    const detectedContent = detectContentByContext(processedText, context)
    if (detectedContent.type === 'incompatible') {
      return { error: 'incompatible', validContentType: null }
    }
    return {
      error: null,
      validContentType: detectedContent.isValid ? detectedContent.type : null
    }
  } catch {
    return { error: 'failed', validContentType: null }
  }
}

function SSPaste({ visible, onClose, onContentPasted, context }: SSPasteProps) {
  const inputRef = useRef<TextInputInstance>(null)
  const [content, setContent] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [previousVisible, setPreviousVisible] = useState(visible)

  if (visible !== previousVisible) {
    setPreviousVisible(visible)
    if (!visible) {
      setContent('')
      setIsProcessing(false)
    }
  }

  const pasteValidation = validatePasteContent(content, context)
  const detectedContentType = pasteValidation.validContentType
  const isValidContent = detectedContentType !== null

  const notifyPasteValidationError = useEffectEvent(() => {
    if (pasteValidation.error) {
      toast.error(t(PASTE_VALIDATION_ERROR_KEY[pasteValidation.error]))
    }
  })

  useEffect(() => {
    notifyPasteValidationError()
  }, [content, context])

  useEffect(() => {
    if (!visible) {
      return
    }

    const visibleSession = { isClosed: false }
    async function loadClipboardContent() {
      try {
        const clipboardText = await readClipboardText()
        if (!visibleSession.isClosed) {
          setContent(clipboardText)
        }
      } catch {
        toast.error(t('paste.error.loadFailed'))
      }
    }

    loadClipboardContent()

    const reloadTimers = new Set<ReturnType<typeof setTimeout>>()
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const timer = setTimeout(async () => {
          reloadTimers.delete(timer)
          await loadClipboardContent()
        }, 1)
        reloadTimers.add(timer)
      }
    })

    return () => {
      visibleSession.isClosed = true
      subscription.remove()
      for (const timer of reloadTimers) {
        clearTimeout(timer)
      }
    }
  }, [visible])

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

      const processedContent = preprocessByContext(content, context)

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
      case 'bitcoin': {
        return t('paste.title.bitcoin')
      }
      case 'lightning': {
        return t('paste.title.lightning')
      }
      case 'ecash': {
        return t('paste.title.ecash')
      }
      case 'nostr': {
        return t('paste.title.nostr')
      }
      case 'ark': {
        return t('paste.title.ark')
      }
      default: {
        return t('paste.title.default')
      }
    }
  }

  function getContextDescription() {
    switch (context) {
      case 'bitcoin': {
        return t('paste.description.bitcoin')
      }
      case 'lightning': {
        return t('paste.description.lightning')
      }
      case 'ecash': {
        return t('paste.description.ecash')
      }
      case 'nostr': {
        return t('paste.description.nostr')
      }
      case 'ark': {
        return t('paste.description.ark')
      }
      default: {
        return t('paste.description.default')
      }
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
        case 'psbt': {
          return t('paste.button.previewPsbt')
        }
        case 'bitcoin_address':
        case 'bitcoin_uri': {
          return t('paste.button.sendToAddress')
        }
        case 'bitcoin_transaction': {
          return t('paste.button.processTransaction')
        }
        case 'ark_address': {
          return t('paste.button.sendToArk')
        }
        case 'lightning_address': {
          return t('paste.button.payLightningAddress')
        }
        case 'lightning_invoice': {
          if (context === 'ecash') {
            return t('paste.button.payLightningInvoice')
          }
          return t('paste.button.payInvoice')
        }
        case 'lnurl': {
          return t('paste.button.processLnurl')
        }
        case 'ecash_token': {
          return t('paste.button.processEcashToken')
        }
        case 'bbqr_fragment': {
          return t('paste.button.processBBQR')
        }
        case 'seed_qr': {
          return t('paste.button.processSeed')
        }
        case 'ur': {
          return t('paste.button.processUR')
        }
        case 'nostr_note':
        case 'nostr_nevent': {
          return t('paste.button.loadNote')
        }
        case 'nostr_npub':
        case 'nostr_nprofile': {
          return t('paste.button.loadProfile')
        }
        case 'nostr_nsec':
        case 'nostr_json': {
          return t('paste.button.processNostr')
        }
        default: {
          return t('paste.button.processContent')
        }
      }
    } else {
      return t('paste.button.default')
    }
  }

  return (
    <SSModal visible={visible} fullOpacity onClose={onClose}>
      <SSVStack
        justifyBetween
        style={{ alignSelf: 'stretch', height: '100%', paddingHorizontal: 20 }}
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
          <TextInput
            ref={inputRef}
            value={content}
            onChangeText={setContent}
            placeholder={getContextDescription()}
            placeholderTextColor={Colors.gray[400]}
            multiline
            blurOnSubmit
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss()
              inputRef.current?.blur()
            }}
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
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[900],
    borderRadius: 5,
    borderWidth: 1,
    color: Colors.white,
    fontSize: 14,
    maxHeight: 400,
    minHeight: 200,
    padding: 10,
    textAlign: 'left'
  }
})

export default SSPaste
