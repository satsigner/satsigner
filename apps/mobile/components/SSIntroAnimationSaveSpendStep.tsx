import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import { t } from '@/locales'
import { Typography } from '@/styles'

type SaveSpendChoice = 'save' | 'spend'

type SSIntroAnimationSaveSpendStepProps = {
  onPick: (choice: SaveSpendChoice) => void
}

function SSIntroAnimationSaveSpendStep({
  onPick
}: SSIntroAnimationSaveSpendStepProps) {
  return (
    <View style={styles.fullScreen} pointerEvents="box-none">
      <View style={styles.inner}>
        <SSButton
          label={t('intro.steps.saveSpend.optionSave')}
          onPress={() => onPick('save')}
          variant="outline"
          textStyle={styles.buttonText}
        />
        <SSButton
          label={t('intro.steps.saveSpend.optionSpend')}
          onPress={() => onPick('spend')}
          variant="outline"
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  )
}

type SSIntroAnimationSaveSpendFollowUpStepProps = {
  branch: SaveSpendChoice
  onPick: () => void
}

export function SSIntroAnimationSaveSpendFollowUpStep({
  branch,
  onPick
}: SSIntroAnimationSaveSpendFollowUpStepProps) {
  const primaryLabel =
    branch === 'save'
      ? t('intro.steps.saveFollowup.optionCreateBitcoin')
      : t('intro.steps.spendFollowup.optionEcashWallet')
  const laterLabel =
    branch === 'save'
      ? t('intro.steps.saveFollowup.optionLater')
      : t('intro.steps.spendFollowup.optionLater')

  return (
    <View style={styles.fullScreen} pointerEvents="box-none">
      <View style={styles.inner}>
        <SSButton
          label={primaryLabel}
          onPress={onPick}
          variant="outline"
          textStyle={styles.buttonText}
        />
        <SSButton
          label={laterLabel}
          onPress={onPick}
          variant="outline"
          textStyle={styles.buttonText}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  buttonText: {
    fontFamily: Typography.sfProTextUltralight,
    fontSize: 20,
    fontWeight: '200',
    letterSpacing: 3
  },
  fullScreen: {
    ...StyleSheet.absoluteFillObject
  },
  inner: {
    alignItems: 'stretch',
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 28
  }
})

export default SSIntroAnimationSaveSpendStep
