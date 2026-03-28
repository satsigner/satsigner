import { PIN_SIZE } from '@/config/auth'

function emptyPin(): string[] {
  return Array.from<string>({ length: PIN_SIZE }).fill('')
}

export { emptyPin }
