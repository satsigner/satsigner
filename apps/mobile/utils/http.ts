import { HTTP_STATUS, HTTP_SUCCESS_RANGE_END } from '@/constants/http'

export function isSuccessfulHttpStatus(status: number) {
  return status >= HTTP_STATUS.OK && status < HTTP_SUCCESS_RANGE_END
}
