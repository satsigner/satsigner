import { usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSTourSpeechBubble from '@/components/SSTourSpeechBubble'
import {
  TOUR_STEP_CONFIGS,
  TOUR_TOTAL_STEPS
} from '@/constants/tour'
import { useTourNavigation } from '@/hooks/useTourNavigation'
import { t } from '@/locales'
import { useTourStore } from '@/store/tour'

const TOUR_DEMO_NAMES = [
  'Signet Demo',
  'Test Wallet',
  'Practice Account',
  'Signet Learner',
  'Bitcoin Student'
]

function randomDemoName(): string {
  const base =
    TOUR_DEMO_NAMES[Math.floor(Math.random() * TOUR_DEMO_NAMES.length)]
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${base} ${suffix}`
}

const STEPS_WITHOUT_OVERLAY = new Set(['idle', 'broadcast_confirm'])

const STEPS_WITH_NEXT = new Set(['receive', 'select_utxos', 'preview_tx'])

function SSTourOverlay() {
  const status = useTourStore((state) => state.status)
  const currentStep = useTourStore((state) => state.currentStep)
  const prefillAccountName = useTourStore((state) => state.prefillAccountName)
  const setPrefillAccountName = useTourStore(
    (state) => state.setPrefillAccountName
  )
  const { handleExit, advance } = useTourNavigation()
  const pathname = usePathname()

  if (status !== 'active' || STEPS_WITHOUT_OVERLAY.has(currentStep)) {
    return null
  }

  const stepConfig =
    currentStep !== 'idle'
      ? TOUR_STEP_CONFIGS[currentStep]
      : null

  if (!stepConfig) {
    return null
  }

  // Exact add page vs sub-pages (singleSig, created, etc.)
  const isOnExactAddPage = pathname.endsWith('/account/add')
  const isOnSingleSigPage =
    currentStep === 'account_setup' && pathname.includes('/account/add/singleSig')
  const isOnAddSubPage =
    currentStep === 'account_setup' &&
    pathname.includes('/account/add/') &&
    !pathname.endsWith('/account/add') &&
    !isOnSingleSigPage

  // Hide during account creation sub-flow so user can proceed normally
  if (isOnAddSubPage) {
    return null
  }

  // Heroic intro: first step before user has navigated to the add page
  const isHeroicIntro =
    currentStep === 'account_setup' && !isOnExactAddPage && !isOnSingleSigPage

  const stepLabel =
    currentStep !== 'no_utxos'
      ? t('tour.step', {
          current: stepConfig.stepNumber,
          total: TOUR_TOTAL_STEPS
        })
      : undefined

  const bubblePosition = isOnExactAddPage ? 'top' : stepConfig.bubblePosition

  const showContinueHint =
    isOnExactAddPage &&
    currentStep === 'account_setup' &&
    prefillAccountName !== null

  const showSingleSigBubble = isOnSingleSigPage

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, isHeroicIntro && styles.heroOverlay]}
    >
      {showContinueHint ? (
        <SSTourSpeechBubble
          position="bottom"
          arrowDirection="down"
          bottomOffset={140}
          title={t('tour.continueStep.title')}
          description={t('tour.continueStep.description')}
          stepLabel={stepLabel}
          onExit={handleExit}
        />
      ) : showSingleSigBubble ? (
        <SSTourSpeechBubble
          position="bottom"
          arrowDirection="down"
          bottomOffset={80}
          title={t('tour.singleSigStep.title')}
          description={t('tour.singleSigStep.description')}
          stepLabel={stepLabel}
          onExit={handleExit}
        />
      ) : (
        <SSTourSpeechBubble
          key={currentStep}
          position={bubblePosition}
          heroic={isHeroicIntro}
          title={t(stepConfig.titleKey)}
          description={t(stepConfig.descriptionKey)}
          stepLabel={stepLabel}
          onExit={handleExit}
        >
          {isHeroicIntro && (
            <SSButton
              label={t('tour.letsStart')}
              variant="secondary"
              onPress={() => advance('account_setup')}
            />
          )}
          {isOnExactAddPage && currentStep === 'account_setup' && (
            <SSButton
              label={t('tour.fillRandom')}
              variant="outline"
              onPress={() => setPrefillAccountName(randomDemoName())}
            />
          )}
          {STEPS_WITH_NEXT.has(currentStep) && (
            <SSButton
              label={t('tour.next')}
              variant="secondary"
              onPress={() => advance(currentStep)}
            />
          )}
          {currentStep === 'no_utxos' && (
            <SSButton
              label={t('tour.noUtxos.fundLater')}
              variant="outline"
              onPress={handleExit}
            />
          )}
        </SSTourSpeechBubble>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999
  },
  heroOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  }
})

export default SSTourOverlay
