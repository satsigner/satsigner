/* eslint-disable no-console */
import Constants from 'expo-constants'

import { DEV_CONSOLE_MAX_MESSAGE_LENGTH } from '@/constants/devConsole'
import { PACKAGE_ID_DEV } from '@/constants/variant'
import {
  clearDevConsoleStorage,
  persistDevConsoleEntry,
  rotateDevConsoleSession
} from '@/storage/devConsoleLog'
import { useDevConsoleStore } from '@/store/devConsole'
import type { DevConsoleLevel } from '@/types/models/DevConsole'

type PendingStep = {
  name: string
  release: () => void
}

type ConsoleMethod = 'error' | 'info' | 'log' | 'warn'

const CONSOLE_LEVELS: Record<ConsoleMethod, DevConsoleLevel> = {
  error: 'error',
  info: 'info',
  log: 'info',
  warn: 'warn'
}

const CONSOLE_METHODS: ConsoleMethod[] = ['error', 'info', 'log', 'warn']

const pendingSteps: PendingStep[] = []
const counter = { nextId: 0 }

export function isDevVariantPackage(packageId: string): boolean {
  return (
    packageId === PACKAGE_ID_DEV || packageId.startsWith(`${PACKAGE_ID_DEV}.`)
  )
}

/**
 * Dev and branch builds only. Production never records logs, so nothing an
 * app prints can end up on screen or in storage there.
 */
export function isDevConsoleAvailable(): boolean {
  if (__DEV__) {
    return true
  }
  const packageId =
    Constants.expoConfig?.android?.package ??
    Constants.expoConfig?.ios?.bundleIdentifier ??
    ''
  return isDevVariantPackage(packageId)
}

function isDevConsoleActive(): boolean {
  return isDevConsoleAvailable() && useDevConsoleStore.getState().enabled
}

export function truncateDevMessage(message: string): string {
  if (message.length <= DEV_CONSOLE_MAX_MESSAGE_LENGTH) {
    return message
  }
  return `${message.slice(0, DEV_CONSOLE_MAX_MESSAGE_LENGTH)}…`
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg
  }
  if (arg instanceof Error) {
    return arg.message
  }
  try {
    return JSON.stringify(arg) ?? String(arg)
  } catch {
    return String(arg)
  }
}

export function formatConsoleArgs(args: unknown[]): string {
  return args.map(stringifyArg).join(' ')
}

export function devLog(
  scope: string,
  message: string,
  level: DevConsoleLevel = 'info'
): void {
  if (!isDevConsoleActive()) {
    return
  }
  const entry = {
    id: counter.nextId,
    level,
    message: truncateDevMessage(message),
    scope,
    time: Date.now()
  }
  counter.nextId += 1
  useDevConsoleStore.getState().addEntry(entry)
  persistDevConsoleEntry(entry)
}

function publishPausedSteps(): void {
  useDevConsoleStore
    .getState()
    .setPausedSteps(pendingSteps.map((step) => step.name))
}

/**
 * Logs a startup step. While Pause is on, the step waits until Next releases
 * it, so the step that freezes the app is the one released last.
 */
export function devStep(scope: string, name: string): Promise<void> {
  devLog(scope, name, 'step')
  if (!isDevConsoleActive() || !useDevConsoleStore.getState().stepMode) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    pendingSteps.push({ name: `${scope}: ${name}`, release: resolve })
    publishPausedSteps()
  })
}

export function releaseNextDevStep(): void {
  const next = pendingSteps.shift()
  publishPausedSteps()
  if (!next) {
    return
  }
  devLog('console', `next → ${next.name}`)
  next.release()
}

export function pauseDevSteps(): void {
  useDevConsoleStore.getState().setStepMode(true)
  devLog('console', 'paused: startup steps wait for Next')
}

export function resumeDevSteps(): void {
  useDevConsoleStore.getState().setStepMode(false)
  const released = pendingSteps.splice(0)
  publishPausedSteps()
  devLog('console', 'resumed')
  for (const step of released) {
    step.release()
  }
}

export function openDevConsole(): void {
  useDevConsoleStore.getState().setPanelOpen(true)
}

export function closeDevConsole(): void {
  useDevConsoleStore.getState().setPanelOpen(false)
}

export function toggleDevConsoleSession(): void {
  const { setShowPrevious, showPrevious } = useDevConsoleStore.getState()
  setShowPrevious(!showPrevious)
}

export function clearDevConsole(): void {
  useDevConsoleStore.getState().clearEntries()
  clearDevConsoleStorage()
}

export function formatDevConsoleTime(time: number): string {
  const date = new Date(time)
  const pad = (value: number, length = 2) => String(value).padStart(length, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function captureConsole(method: ConsoleMethod): void {
  const original = console[method]
  console[method] = (...args: unknown[]) => {
    devLog('console', formatConsoleArgs(args), CONSOLE_LEVELS[method])
    original(...args)
  }
}

function captureGlobalErrors(): void {
  try {
    const previous = ErrorUtils.getGlobalHandler()
    const recordGlobalError = (error: unknown, fatal?: boolean) => {
      devLog(fatal ? 'fatal' : 'error', stringifyArg(error), 'error')
      previous(error, fatal)
    }
    ErrorUtils.setGlobalHandler(recordGlobalError)
  } catch {
    // ErrorUtils is missing in some environments; console capture still works.
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __satsignerDevConsole__: boolean | undefined
}

/**
 * Starts a new console session: the last run's lines become the previous
 * session, and console output and uncaught errors are recorded. Call once at
 * app start, before any component code runs.
 */
export function installDevConsole(): void {
  if (!isDevConsoleAvailable() || globalThis.__satsignerDevConsole__) {
    return
  }
  globalThis.__satsignerDevConsole__ = true
  useDevConsoleStore.getState().setPreviousEntries(rotateDevConsoleSession())
  for (const method of CONSOLE_METHODS) {
    captureConsole(method)
  }
  captureGlobalErrors()
  devLog('console', 'app started')
}
