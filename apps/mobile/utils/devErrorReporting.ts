/* eslint-disable no-console, @typescript-eslint/no-require-imports */
/**
 * Dev-only error reporting: make Metro's console output show the SOURCE
 * file and line of every crash, not just the message.
 *
 * Why this exists: RN's default handlers log only `error.message` for
 * unhandled rejections and component errors. The red box on device shows
 * file:line because LogBox symbolicates the stack through Metro's
 * /symbolicate endpoint; the console path never does. With Hermes bytecode
 * bundles, raw stacks point at bundle offsets, so we symbolicate with the
 * same internal modules LogBox uses.
 */

type ParsedFrame = {
  column?: number
  file?: string
  lineNumber?: number
  methodName?: string
}

type SymbolicatedFrame = {
  column?: number
  file?: string
  lineNumber?: number
  methodName?: string
}

type SymbolicatedStack = {
  stack: SymbolicatedFrame[]
}

function formatFrame(frame: SymbolicatedFrame): string {
  const method = frame.methodName || '<anonymous>'
  if (!frame.file) {
    return `    at ${method}`
  }
  const line = frame.lineNumber ?? '?'
  const column = frame.column ?? '?'
  return `    at ${method} (${frame.file}:${line}:${column})`
}

async function symbolicate(error: unknown): Promise<string | null> {
  try {
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack')
    const symbolicateStackTrace = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace')

    const stack: unknown = (error as { stack?: unknown })?.stack
    if (typeof stack !== 'string' || !stack) {
      return null
    }

    const parsed: ParsedFrame[] = (parseErrorStack.default ?? parseErrorStack)(
      stack
    )
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null
    }

    const symbolicated: SymbolicatedStack = await (
      symbolicateStackTrace.default ?? symbolicateStackTrace
    )(parsed)

    const frames = symbolicated?.stack ?? []
    const lines = frames
      .filter((frame) => frame?.file)
      .map(formatFrame)
      .filter((line) => !line.includes('/node_modules/'))
    return lines.length > 0 ? lines.join('\n') : null
  } catch {
    return null
  }
}

function report(prefix: string, error: unknown): void {
  const message =
    error instanceof Error ? error.message : String(error ?? 'unknown')
  const rawStack =
    error instanceof Error && typeof error.stack === 'string' ? error.stack : ''

  // Log message + raw stack immediately (raw frames name the failing
  // function even before symbolication resolves).
  console.error(`${prefix}: ${message}\n${rawStack}`)

  void symbolicate(error).then((sourceFrames) => {
    if (sourceFrames) {
      console.error(`${prefix} source location:\n${sourceFrames}`)
    }
  })
}

/**
 * Installs dev error hooks. Call once at app start (root layout). No-op
 * outside __DEV__ and safe to call multiple times.
 */
export function installDevErrorReporting(): void {
  if (!__DEV__) {
    return
  }
  const marker = '__satsignerDevErrorReporting__'
  const globalAny = globalThis as Record<string, unknown>
  if (globalAny[marker]) {
    return
  }
  globalAny[marker] = true

  // Unhandled promise rejections (the "[Error: Uncaught (in promise, id: N)]"
  // messages that currently print no location).
  try {
    require('promise/setimmediate/rejection-tracking').enable({
      allRejections: true,
      onHandled: () => {},
      onUnhandled: (_id: number, error: unknown) => {
        report('Uncaught (in promise)', error)
      }
    })
  } catch {
    // Rejection tracker unavailable — keep going, fatal hook still helps.
  }

  // Fatal/synchronous errors (component crashes, render throws).
  try {
    const errorUtils = globalAny.ErrorUtils as
      | {
          getGlobalHandler?: () => (error: unknown, fatal: boolean) => void
          setGlobalHandler?: (
            handler: (error: unknown, fatal: boolean) => void
          ) => void
        }
      | undefined
    const previous = errorUtils?.getGlobalHandler?.()
    errorUtils?.setGlobalHandler?.((error, fatal) => {
      report(fatal ? 'Fatal error' : 'Error', error)
      previous?.(error, fatal)
    })
  } catch {
    // ErrorUtils unavailable — rejection hook above still covers promises.
  }
}
