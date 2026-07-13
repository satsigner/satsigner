import { mainRed, warning, white } from '@/styles/colors'

export function getUnspentOutputSatsColor(params: {
  value?: number
  maxAllowedSats?: number
  isChange: boolean
  isMiningFee: boolean
  isGreenOutput: boolean
}): string {
  const { value, maxAllowedSats, isChange, isMiningFee, isGreenOutput } = params

  if (
    !isChange &&
    !isMiningFee &&
    typeof value === 'number' &&
    typeof maxAllowedSats === 'number'
  ) {
    return value > maxAllowedSats ? warning : white
  }

  return isGreenOutput ? white : mainRed
}
