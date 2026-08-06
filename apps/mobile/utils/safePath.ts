const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/
const UNSAFE_FILENAME_CHARS = /[^A-Za-z0-9._-]+/g

/**
 * Reject path traversal / separators in identifiers used for filesystem paths.
 */
export function assertSafePathSegment(segment: string, label = 'id'): string {
  if (
    !segment ||
    segment === '.' ||
    segment === '..' ||
    segment.includes('/') ||
    segment.includes('\\') ||
    !SAFE_SEGMENT.test(segment)
  ) {
    throw new Error(`Invalid ${label}: must be a single safe path segment`)
  }
  return segment
}

/** Sanitize a user-facing name for use in an export filename. */
export function sanitizeFilenamePart(
  name: string,
  fallback = 'export'
): string {
  const cleaned = name.trim().replace(UNSAFE_FILENAME_CHARS, '_').slice(0, 64)
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return fallback
  }
  return cleaned
}
