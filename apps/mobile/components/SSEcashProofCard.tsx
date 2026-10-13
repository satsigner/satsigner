import * as Clipboard from 'expo-clipboard'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { EcashKeyset, EcashProof } from '@/types/models/Ecash'

import SSPressable from './SSPressable'

type SSEcashProofCardProps = {
  keysetCounters?: Record<string, number>
  keysets?: EcashKeyset[]
  onPress?: () => void
  proof: EcashProof
  proofIndex: number
}

function SSEcashProofCard({
  keysetCounters,
  keysets,
  onPress,
  proof,
  proofIndex
}: SSEcashProofCardProps) {
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )

  const keyset = keysets?.find((ks) => ks.id === proof.id)
  const counter = keysetCounters?.[proof.id]

  async function handleCopySecret() {
    try {
      await Clipboard.setStringAsync(proof.secret)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  async function handleCopyC() {
    try {
      await Clipboard.setStringAsync(proof.C)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  return (
    <SSPressable
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <SSVStack style={styles.container} gap="xs">
        <SSHStack justifyBetween style={{ alignItems: 'center' }}>
          <SSText color="muted" size="xs">
            #{proofIndex + 1}
          </SSText>
          <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
            <SSAmountDisplay
              privacyMode={privacyMode}
              amount={proof.amount}
              decimals={0}
              useZeroPadding={useZeroPadding}
              currency={currencyUnit}
              textSize="lg"
              weight="medium"
              letterSpacing={-0.5}
              unitSize="xs"
            />
          </SSHStack>
        </SSHStack>

        <SSVStack gap="xs">
          <SSVStack gap="none">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.proofs.keysetId')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'center' }}>
              <SSText type="mono" size="xs">
                {proof.id}
              </SSText>
              {keyset && (
                <SSText
                  size="xs"
                  style={{
                    color: keyset.active ? Colors.success : Colors.gray[500]
                  }}
                >
                  {keyset.active
                    ? t('ecash.proofs.active')
                    : t('ecash.proofs.inactive')}
                </SSText>
              )}
            </SSHStack>
          </SSVStack>

          <SSVStack gap="none">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.proofs.secret')}
            </SSText>
            <SSPressable onPress={handleCopySecret} activeOpacity={0.7}>
              <SSText type="mono" size="xs" numberOfLines={1}>
                {privacyMode ? '••••••••••••••••' : proof.secret}
              </SSText>
            </SSPressable>
          </SSVStack>

          <SSVStack gap="none">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.proofs.blindingFactor')}
            </SSText>
            <SSPressable onPress={handleCopyC} activeOpacity={0.7}>
              <SSText type="mono" size="xs" numberOfLines={1}>
                {privacyMode ? '••••••••••••••••' : proof.C}
              </SSText>
            </SSPressable>
          </SSVStack>

          {proof.mintUrl && (
            <SSVStack gap="none">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.proofs.mintUrl')}
              </SSText>
              <SSText type="mono" size="xs" numberOfLines={1}>
                {proof.mintUrl}
              </SSText>
            </SSVStack>
          )}

          {counter !== undefined && (
            <SSVStack gap="none">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.proofs.derivationCounter')}
              </SSText>
              <SSText type="mono" size="xs">
                {counter}
              </SSText>
            </SSVStack>
          )}
        </SSVStack>
      </SSVStack>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  container: {
    borderColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8
  }
})

export default SSEcashProofCard
