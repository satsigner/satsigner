import { StyleSheet, TouchableOpacity, View } from 'react-native'

import { SSIconCloseThin } from '@/components/icons'
import SSGlassButton from '@/components/SSGlassButton'
import SSText from '@/components/SSText'
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
      <SSVStack style={styles.inner} gap="sm" itemsCenter widthFull>
        <View style={styles.headerBand}>
          <TouchableOpacity
            accessibilityLabel={t('common.close')}
            onPress={dismissSettingsBanner}
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            style={styles.closeButton}
          >
            <SSIconCloseThin width={10} height={10} color={Colors.gray[600]} />
          </TouchableOpacity>
          <SSText
            center
            size="xxs"
            uppercase
            weight="medium"
            style={styles.labelText}
          >
            {t('tour.banner.label')}
          </SSText>
        </View>
        <SSText
          center
          size="sm"
          weight="medium"
          color="black"
          style={styles.bodyText}
        >
          {t('tour.banner.message')}
        </SSText>
        <SSGlassButton
          label={`${t('tour.banner.start')} →`}
          onPress={onStartTour}
        />
      </SSVStack>
    </View>
  )
}

const styles = StyleSheet.create({
  bodyText: {
    alignSelf: 'stretch'
  },
  closeButton: {
    padding: 4,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1
  },
  container: {
    backgroundColor: Colors.white,
    borderRadius: Sizes.button.borderRadius,
    marginBottom: 24,
    marginHorizontal: 24,
    marginTop: 12,
    overflow: 'hidden'
  },
  headerBand: {
    alignSelf: 'stretch',
    paddingTop: 2,
    position: 'relative'
  },
  inner: {
    padding: 14
  },
  labelText: {
    alignSelf: 'stretch',
    color: Colors.gray[500],
    paddingHorizontal: 28
  }
})

export default SSTourBanner
