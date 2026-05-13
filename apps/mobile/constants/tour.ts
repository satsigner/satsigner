import { type TourStep } from '@/store/tour'

export type TourBubblePosition = 'top' | 'center' | 'bottom'

export type TourStepConfig = {
  id: TourStep
  bubblePosition: TourBubblePosition
  titleKey: string
  descriptionKey: string
  stepNumber: number
}

export const TOUR_TOTAL_STEPS = 7

/** Bottom offset (px) for tour bubbles anchored to safe area bottom */
export const TOUR_BUBBLE_BOTTOM_OFFSET_CONTINUE_HINT = 140
export const TOUR_BUBBLE_BOTTOM_OFFSET_IMPORT_MNEMONIC = 150
export const TOUR_BUBBLE_BOTTOM_OFFSET_SINGLE_SIG = 280

/** Top offset (px) for tour bubbles using `position: "top"` */
export const TOUR_BUBBLE_TOP_ACCOUNT_LIST = 280
export const TOUR_BUBBLE_TOP_NAME_WALLET = 248

export const TOUR_OVERLAY_Z_INDEX = 999

export const TOUR_STEP_CONFIGS: Record<
  Exclude<TourStep, 'idle'>,
  TourStepConfig
> = {
  account_setup: {
    bubblePosition: 'center',
    descriptionKey: 'tour.steps.accountSetup.description',
    id: 'account_setup',
    stepNumber: 1,
    titleKey: 'tour.steps.accountSetup.title'
  },
  add_account: {
    bubblePosition: 'center',
    descriptionKey: 'tour.steps.addAccount.description',
    id: 'add_account',
    stepNumber: 0,
    titleKey: 'tour.steps.addAccount.title'
  },
  broadcast_confirm: {
    bubblePosition: 'top',
    descriptionKey: 'tour.steps.broadcastConfirm.description',
    id: 'broadcast_confirm',
    stepNumber: 7,
    titleKey: 'tour.steps.broadcastConfirm.title'
  },
  explore_wallet: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.exploreWallet.description',
    id: 'explore_wallet',
    stepNumber: 2,
    titleKey: 'tour.steps.exploreWallet.title'
  },
  no_utxos: {
    bubblePosition: 'center',
    descriptionKey: 'tour.steps.noUtxos.description',
    id: 'no_utxos',
    stepNumber: 3,
    titleKey: 'tour.steps.noUtxos.title'
  },
  preview_tx: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.previewTx.description',
    id: 'preview_tx',
    stepNumber: 5,
    titleKey: 'tour.steps.previewTx.title'
  },
  receive: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.receive.description',
    id: 'receive',
    stepNumber: 3,
    titleKey: 'tour.steps.receive.title'
  },
  select_utxos: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.selectUtxos.description',
    id: 'select_utxos',
    stepNumber: 4,
    titleKey: 'tour.steps.selectUtxos.title'
  },
  sign_tx: {
    bubblePosition: 'center',
    descriptionKey: 'tour.steps.signTx.description',
    id: 'sign_tx',
    stepNumber: 6,
    titleKey: 'tour.steps.signTx.title'
  }
}
