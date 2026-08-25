import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Network } from '@/types/settings/blockchain'
import { verifyAddressMessage } from '@/utils/message'

type SSVerifyMessageProps = {
  address: string
  network: Network
}

type VerifyResult = 'valid' | 'invalid' | 'unsupported' | null

function SSVerifyMessage({ address, network }: SSVerifyMessageProps) {
  const [message, setMessage] = useState('')
  const [signature, setSignature] = useState('')
  const [result, setResult] = useState<VerifyResult>(null)

  function handleVerify() {
    const { valid, method } = verifyAddressMessage(
      address,
      message,
      signature.trim(),
      network
    )
    if (!method) {
      setResult('unsupported')
      return
    }
    setResult(valid ? 'valid' : 'invalid')
  }

  function handleChangeMessage(value: string) {
    setMessage(value)
    setResult(null)
  }

  function handleChangeSignature(value: string) {
    setSignature(value)
    setResult(null)
  }

  return (
    <SSVStack gap="lg" style={styles.container}>
      <SSVStack gap="sm">
        <SSText uppercase weight="bold">
          {t('bitcoin.address')}
        </SSText>
        <SSAddressDisplay address={address} />
      </SSVStack>
      <SSSeparator />
      <SSVStack gap="sm">
        <SSText uppercase weight="bold">
          {t('address.verifyMessage.message')}
        </SSText>
        <SSTextInput
          align="left"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          style={styles.messageInput}
          placeholder={t('address.verifyMessage.messagePlaceholder')}
          value={message}
          onChangeText={handleChangeMessage}
        />
      </SSVStack>
      <SSVStack gap="sm">
        <SSText uppercase weight="bold">
          {t('address.verifyMessage.signature')}
        </SSText>
        <SSTextInput
          align="left"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={styles.signatureInput}
          placeholder={t('address.verifyMessage.signaturePlaceholder')}
          value={signature}
          onChangeText={handleChangeSignature}
        />
      </SSVStack>
      <SSButton
        label={t('address.verifyMessage.verify')}
        variant="secondary"
        disabled={!signature.trim()}
        onPress={handleVerify}
      />
      {result === 'valid' && (
        <SSText center style={styles.validText}>
          {t('address.verifyMessage.valid')}
        </SSText>
      )}
      {result === 'invalid' && (
        <SSText center style={styles.invalidText}>
          {t('address.verifyMessage.invalid')}
        </SSText>
      )}
      {result === 'unsupported' && (
        <SSText center color="muted">
          {t('address.verifyMessage.unsupported')}
        </SSText>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  invalidText: { color: Colors.mainRed },
  messageInput: { height: 'auto', minHeight: 140, paddingVertical: 10 },
  signatureInput: { height: 'auto', minHeight: 100, paddingVertical: 10 },
  validText: { color: Colors.mainGreen }
})

export default SSVerifyMessage
