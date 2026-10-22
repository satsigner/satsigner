import { t } from '@/locales'
import { type Message } from '@/types/ui/notice'

/** Text to display for a message reported by a hook. */
export function formatMessage(message: Message) {
  if ('text' in message) {
    return message.text
  }
  return t(message.key, message.params)
}
