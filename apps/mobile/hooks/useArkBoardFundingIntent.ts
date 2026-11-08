import { useArkStore } from '@/store/ark'
import { type Output } from '@/types/models/Output'
import { findArkBoardIntent } from '@/utils/arkBoardFunding'

export function useArkBoardFundingIntent(outputs: Pick<Output, 'to'>[]) {
  const boardIntents = useArkStore((state) => state.boardIntents)
  return findArkBoardIntent(
    outputs.map((output) => output.to),
    boardIntents
  )
}
