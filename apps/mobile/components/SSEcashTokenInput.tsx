import { useCallback } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSEcashTokenInputProps = {
  value: string
  onChangeText: (text: string) => void
  onPaste?: () => void
  onScan?: () => void
  placeholder?: string
  multiline?: boolean
  style?: any
}

function SSEcashTokenInput({
  value,
  onChangeText,
  onPaste,
  onScan,
  placeholder = 'cashuAeyJ...',
  multiline = true,
  style
}: SSEcashTokenInputProps) {
  const handlePaste = useCallback(async () => {
    try {
      // TODO: Implement clipboard paste
      if (onPaste) {
        onPaste()
      } else {
        toast.success(t('common.copiedToClipboard'))
      }
    } catch {
      toast.error('Failed to paste from clipboard')
    }
  }, [onPaste])

  const handleScan = useCallback(() => {
    try {
      if (onScan) {
        onScan()
      } else {
        toast.error('QR scanner not implemented yet')
      }
    } catch {
      toast.error('Failed to scan QR code')
    }
  }, [onScan])

  return (
    <SSVStack gap="sm">
      <SSTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        style={[styles.tokenInput, style]}
      />
      <SSHStack gap="sm">
        <SSButton
          label={t('common.paste')}
          onPress={handlePaste}
          variant="outline"
          style={{ flex: 1 }}
        />
        <SSButton
          label={t('common.scan')}
          onPress={handleScan}
          variant="outline"
          style={{ flex: 1 }}
        />
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  tokenInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 10,
    fontSize: 14,
    fontFamily: 'monospace'
  }
})

export default SSEcashTokenInput
