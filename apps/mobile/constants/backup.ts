export const BACKUP_FILE_MIME_TYPE = 'application/json'

// Largest backup the recover screen reads into memory.
export const MAX_BACKUP_FILE_BYTES = 20_000_000

// Longer backup text is held off-screen: a multiline TextInput lays out its
// whole value on the UI thread and freezes on large payloads.
export const MAX_BACKUP_INPUT_CHARS = 20_000

// A rollback rewrites every snapshotted entry, so running it again after a
// partial failure is safe.
export const RESTORE_ROLLBACK_ATTEMPTS = 3

// Stays until dismissed: the user must not miss that their old data may be
// only partly back.
export const RESTORE_ROLLBACK_INCOMPLETE_TOAST_DURATION_MS =
  Number.POSITIVE_INFINITY
