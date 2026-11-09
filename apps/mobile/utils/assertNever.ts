/** Compile-time exhaustiveness check for switches over a union. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled state: ${JSON.stringify(value)}`)
}
