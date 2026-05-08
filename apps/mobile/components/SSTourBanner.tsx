import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { SSIconCloseThin } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useTourStore } from '@/store/tour'
import { Colors, Sizes } from '@/styles'

type SSTourBannerProps = {
  onStartTour(): void
}

function SSTourBanner({ onStartTour }: SSTourBannerProps) {
  const neverAskAgain = useTourStore((state) => state.neverAskAgain)
  const settingsBannerDismissed = useTourStore(
    (state) => state.settingsBannerDismissed
  )
  const dismissSettingsBanner = useTourStore(
    (state) => state.dismissSettingsBanner
  )

  if (neverAskAgain || settingsBannerDismissed) {
    return null
  }

  return (
    <View style={styles.container}>
      <SSVStack style={styles.inner} gap="sm">
        <SSHStack justifyBetween style={styles.headerRow}>
          <SSText size="xxs" uppercase weight="medium" style={styles.labelText}>
            {t('tour.banner.label')}
          </SSText>
          <TouchableOpacity
            onPress={dismissSettingsBanner}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          >
            <SSIconCloseThin width={10} height={10} color={Colors.gray[600]} />
          </TouchableOpacity>
        </SSHStack>
        <SSText size="sm" weight="medium" color="black">
          {t('tour.banner.message')}
        </SSText>
        <SSButton
          label={`${t('tour.banner.start')} →`}
          variant="secondary"
          onPress={onStartTour}
        />
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.button.borderRadius,
    marginHorizontal: 24,
    marginVertical: 12,
    overflow: 'hidden'
  },
  headerRow: {
    alignItems: 'center'
  },
  inner: {
    padding: 14
  },
  labelText: {
    color: Colors.gray[500]
  }
})

export default SSTourBanner
