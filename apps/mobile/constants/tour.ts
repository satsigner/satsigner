import { type TourStep } from '@/store/tour'

export type TourBubblePosition = 'top' | 'center' | 'bottom'

export type TourStepConfig = {
  id: TourStep
  bubblePosition: TourBubblePosition
  titleKey: string
  descriptionKey: string
  stepNumber: number
}

export const TOUR_TOTAL_STEPS = 6

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
  broadcast_confirm: {
    bubblePosition: 'top',
    descriptionKey: 'tour.steps.broadcastConfirm.description',
    id: 'broadcast_confirm',
    stepNumber: 6,
    titleKey: 'tour.steps.broadcastConfirm.title'
  },
  no_utxos: {
    bubblePosition: 'center',
    descriptionKey: 'tour.steps.noUtxos.description',
    id: 'no_utxos',
    stepNumber: 2,
    titleKey: 'tour.steps.noUtxos.title'
  },
  preview_tx: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.previewTx.description',
    id: 'preview_tx',
    stepNumber: 4,
    titleKey: 'tour.steps.previewTx.title'
  },
  receive: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.receive.description',
    id: 'receive',
    stepNumber: 2,
    titleKey: 'tour.steps.receive.title'
  },
  select_utxos: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.selectUtxos.description',
    id: 'select_utxos',
    stepNumber: 3,
    titleKey: 'tour.steps.selectUtxos.title'
  },
  sign_tx: {
    bubblePosition: 'bottom',
    descriptionKey: 'tour.steps.signTx.description',
    id: 'sign_tx',
    stepNumber: 5,
    titleKey: 'tour.steps.signTx.title'
  }
}
