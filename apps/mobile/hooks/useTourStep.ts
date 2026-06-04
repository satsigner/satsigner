import { type TourStep, useTourStore } from '@/store/tour'

function useTourStep(step: TourStep): { isActive: boolean } {
  const currentStep = useTourStore((state) => state.currentStep)
  const status = useTourStore((state) => state.status)
  return { isActive: status === 'active' && currentStep === step }
}

export { useTourStep }
