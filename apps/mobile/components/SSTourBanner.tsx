import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSButton from '@/components/SSButton'
import { SSIconCloseThin } from '@/components/icons'
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
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.03)',
          'rgba(255, 255, 255, 0)',
          'rgba(255, 255, 255, 0.012)'
        ]}
        end={{ x: 0.8, y: 0.4 }}
        locations={[0, 0.55, 1]}
        pointerEvents="none"
        start={{ x: 0.14, y: 0 }}
        style={[StyleSheet.absoluteFillObject, styles.glassSheen]}
      />
      <View pointerEvents="none" style={styles.innerStroke} />
      <SSVStack style={styles.inner} gap="sm">
        <SSHStack justifyBetween style={styles.headerRow}>
          <SSText size="xxs" uppercase weight="medium" style={styles.labelText}>
            {t('tour.banner.label')}
          </SSText>
          <TouchableOpacity
            onPress={dismissSettingsBanner}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          >
            <SSIconCloseThin width={10} height={10} />
          </TouchableOpacity>
        </SSHStack>
        <SSText size="sm" weight="medium" color="white">
          {t('tour.banner.message')}
        </SSText>
        <SSButton
          label={`${t('tour.banner.start')} →`}
          variant="outline"
          onPress={onStartTour}
        />
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.gray[925],
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: Sizes.button.borderRadius,
    borderWidth: 1,
    elevation: 10,
    marginHorizontal: 24,
    marginVertical: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#FFFFFF',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 14
  },
  glassSheen: {
    borderRadius: Sizes.button.borderRadius,
    zIndex: 1
  },
  headerRow: {
    alignItems: 'center'
  },
  inner: {
    padding: 14,
    position: 'relative',
    zIndex: 3
  },
  innerStroke: {
    borderColor: 'rgba(255, 255, 255, 0.045)',
    borderRadius: Sizes.button.borderRadius - 1,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 1,
    left: 1,
    position: 'absolute',
    right: 1,
    top: 1,
    zIndex: 2
  },
  labelText: {
    color: Colors.gray[300]
  },
})

export default SSTourBanner
