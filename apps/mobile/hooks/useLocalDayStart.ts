import { MS_PER_SECOND } from '@/constants/time'
import { useNow } from '@/hooks/useNow'
import { startOfLocalDay } from '@/utils/nostrChatRows'

/** Start of today in local time (seconds); changes only at midnight. */
function useLocalDayStart(): number {
  const nowMs = useNow()
  return startOfLocalDay(Math.floor(nowMs / MS_PER_SECOND))
}

export { useLocalDayStart }
