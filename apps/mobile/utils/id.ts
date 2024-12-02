/**
 * Generates a simple id based on the current timestamp and a random suffix
 *
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export { generateId }
