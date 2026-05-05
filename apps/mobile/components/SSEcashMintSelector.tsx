import { Pressable, ScrollView, StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import type { EcashMint, EcashProof } from '@/types/models/Ecash'

type Props = {
  mints: EcashMint[]
  selectedMint: EcashMint | null
  onSelect: (mint: EcashMint) => void
  proofs: EcashProof[]
}

function SSEcashMintSelector({ mints, selectedMint, onSelect, proofs }: Props) {
  if (mints.length <= 1) {
    return null
  }

  return (
    <SSVStack gap="xs">
      <SSText color="muted" size="xs" uppercase>
        {t('ecash.mint.selectMint')}
      </SSText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {mints.map((mint) => {
          const balance = proofs
            .filter((p) => p.mintUrl === mint.url)
            .reduce((sum, p) => sum + p.amount, 0)
          const isSelected = selectedMint?.url === mint.url
          const label = mint.name ?? mint.url

          return (
            <Pressable
              key={mint.url}
              onPress={() => onSelect(mint)}
              style={[
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
            >
              <SSText
                size="xs"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[
                  styles.pillLabel,
                  { color: isSelected ? Colors.white : Colors.gray[50] }
                ]}
              >
                {label}
              </SSText>
              <SSText
                size="xs"
                style={{
                  color: isSelected ? Colors.gray[200] : Colors.gray[500]
                }}
              >
                {balance} {t('bitcoin.sats')}
              </SSText>
            </Pressable>
          )
        })}
      </ScrollView>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    marginRight: 8,
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  pillLabel: {
    maxWidth: 136
  },
  pillSelected: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.gray[75],
    borderWidth: 1
  },
  pillUnselected: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[900],
    borderWidth: 1
  },
  scrollContent: {
    paddingBottom: 2
  }
})

export default SSEcashMintSelector
