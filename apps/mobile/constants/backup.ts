export const BACKUP_FILE_MIME_TYPE = 'application/json'

// Largest backup the recover screen reads into memory.
export const MAX_BACKUP_FILE_BYTES = 20_000_000

// Longer backup text is held off-screen: a multiline TextInput lays out its
// whole value on the UI thread and freezes on large payloads.
export const MAX_BACKUP_INPUT_CHARS = 20_000
