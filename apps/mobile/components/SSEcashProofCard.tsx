import * as Clipboard from 'expo-clipboard'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { EcashKeyset, EcashProof } from '@/types/models/Ecash'

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
    <TouchableOpacity
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
            {privacyMode ? (
              <SSText size="lg" weight="medium">
                ••••
              </SSText>
            ) : (
              <SSStyledSatText
                amount={proof.amount}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                textSize="lg"
                weight="medium"
                letterSpacing={-0.5}
              />
            )}
            <SSText color="muted" size="xs">
              {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
            </SSText>
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
            <TouchableOpacity onPress={handleCopySecret} activeOpacity={0.7}>
              <SSText type="mono" size="xs" numberOfLines={1}>
                {privacyMode ? '••••••••••••••••' : proof.secret}
              </SSText>
            </TouchableOpacity>
          </SSVStack>

          <SSVStack gap="none">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.proofs.blindingFactor')}
            </SSText>
            <TouchableOpacity onPress={handleCopyC} activeOpacity={0.7}>
              <SSText type="mono" size="xs" numberOfLines={1}>
                {privacyMode ? '••••••••••••••••' : proof.C}
              </SSText>
            </TouchableOpacity>
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
    </TouchableOpacity>
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
