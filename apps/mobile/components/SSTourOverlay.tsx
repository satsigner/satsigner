import { usePathname } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSTourSpeechBubble from '@/components/SSTourSpeechBubble'
import { TOUR_STEP_CONFIGS, TOUR_TOTAL_STEPS } from '@/constants/tour'
import { useTourNavigation } from '@/hooks/useTourNavigation'
import { t } from '@/locales'
import { type TourStep, useTourStore } from '@/store/tour'

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

const STEPS_WITH_NEXT = new Set([
  'explore_wallet',
  'receive',
  'select_utxos',
  'preview_tx'
])

const STEPS_WITHOUT_STEP_LABEL = new Set<TourStep>([
  'go_to_bitcoin',
  'add_account',
  'no_utxos'
])

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
    currentStep !== 'idle' ? TOUR_STEP_CONFIGS[currentStep] : null

  if (!stepConfig) {
    return null
  }

  const isOnAccountListAddAccount =
    currentStep === 'add_account' && pathname.includes('/bitcoin/accountList')

  // Exact add page vs sub-pages (singleSig, mnemonic, created, etc.)
  const isOnExactAddPage = pathname.endsWith('/account/add')
  const isOnSingleSigPage =
    currentStep === 'account_setup' &&
    pathname.includes('/account/add/singleSig')
  const isOnMnemonicPage =
    currentStep === 'account_setup' &&
    pathname.includes('/account/add/') &&
    pathname.includes('/generate/mnemonic')
  const isOnImportMnemonicPage =
    currentStep === 'account_setup' &&
    pathname.includes('/account/add/') &&
    pathname.includes('/import/mnemonic')
  const isOnAddSubPage =
    currentStep === 'account_setup' &&
    pathname.includes('/account/add/') &&
    !pathname.endsWith('/account/add') &&
    !isOnSingleSigPage &&
    !isOnMnemonicPage &&
    !isOnImportMnemonicPage

  // Hide account_setup bubble when not on an account/add page (stale persisted state)
  const isAccountSetupStep = currentStep === 'account_setup'
  const isOnAnyAddPage = pathname.includes('/account/add')
  if (isAccountSetupStep && !isOnAnyAddPage) {
    return null
  }

  // Hide during account creation sub-flow so user can proceed normally
  if (isOnAddSubPage) {
    return null
  }

  // Heroic intro: go_to_bitcoin step (always heroic, any screen)
  const isHeroicIntro = currentStep === 'go_to_bitcoin'

  const stepLabel = STEPS_WITHOUT_STEP_LABEL.has(currentStep)
    ? undefined
    : t('tour.step', {
        current: stepConfig.stepNumber,
        total: TOUR_TOTAL_STEPS
      })

  const bubblePosition = isOnExactAddPage ? 'top' : stepConfig.bubblePosition

  const showContinueHint =
    isOnExactAddPage &&
    currentStep === 'account_setup' &&
    prefillAccountName !== null

  const showAccountListBubble = isOnAccountListAddAccount
  const showSingleSigBubble = isOnSingleSigPage
  const showMnemonicBubble = isOnMnemonicPage
  const showImportMnemonicBubble = isOnImportMnemonicPage

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, isHeroicIntro && styles.heroOverlay]}
    >
      {showAccountListBubble ? (
        <SSTourSpeechBubble
          key="bubble_add_account"
          position="top"
          wrapperStyle={{ top: 280 }}
          title={t('tour.steps.addAccount.title')}
          description={t('tour.steps.addAccount.description')}
          onExit={handleExit}
        />
      ) : showContinueHint ? (
        <SSTourSpeechBubble
          key="bubble_continue_hint"
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
          key="bubble_single_sig"
          position="bottom"
          arrowDirection="down"
          bottomOffset={280}
          title={t('tour.singleSigStep.title')}
          description={t('tour.singleSigStep.description')}
          onExit={handleExit}
        />
      ) : showMnemonicBubble ? (
        <SSTourSpeechBubble
          key="bubble_mnemonic"
          position="bottom"
          title={t('tour.mnemonicStep.title')}
          description={t('tour.mnemonicStep.description')}
          stepLabel={stepLabel}
          onExit={handleExit}
        />
      ) : showImportMnemonicBubble ? (
        <SSTourSpeechBubble
          key="bubble_import_mnemonic"
          position="bottom"
          arrowDirection="up"
          bottomOffset={150}
          title={t('tour.importMnemonicStep.title')}
          description={t('tour.importMnemonicStep.description')}
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
              onPress={() => advance('go_to_bitcoin')}
            />
          )}
          {isOnExactAddPage && currentStep === 'account_setup' && (
            <SSButton
              label={t('tour.fillRandom')}
              variant="ghost"
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
