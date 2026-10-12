// A user-facing message: an i18n key translated by the page, or text that is
// already user-facing (e.g. an error message from a library).
export type Message =
  | { key: string; params?: Record<string, string | number> }
  | { text: string }

export type NoticeType = 'success' | 'error' | 'info' | 'warning'

// A message a hook reports for the page to show, e.g. as a toast.
export type Notice = Message & { type: NoticeType }
