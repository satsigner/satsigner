/**
 * (c) Copyright 2024 by Coinkite Inc. This file is in the public domain.
 *
 * Helper/utility functions.
 */

import { base32, hex } from '@scure/base'
import pako from 'pako'

import { QR_DATA_CAPACITY } from './consts'
import type { Encoding, SplitOptions, Version } from './types'

export function intToBase36(n: number) {
  // convert an integer 0-1295 to two digits of base 36 - 00-ZZ

  if (n < 0 || n > 1295 || !Number.isInteger(n)) {
    throw new Error('Out of range')
  }

  return n.toString(36).toUpperCase().padStart(2, '0')
}

function joinByteParts(parts: Uint8Array[]) {
  // perf-optimized way to join Uint8Arrays

  const length = parts.reduce((acc, bytes) => acc + bytes.length, 0)

  const rv = new Uint8Array(length)

  let offset = 0
  for (const bytes of parts) {
    rv.set(bytes, offset)
    offset += bytes.length
  }

  return rv
}

function isValidVersion(v: number): v is Version {
  // act as a TS type guard but also a runtime check

  return v in QR_DATA_CAPACITY
}

function isValidSplit(s: number) {
  return s >= 1 && s <= 1295
}

export function validateSplitOptions(opts: SplitOptions) {
  // ensure all split options are valid, filling in defaults as needed

  const allOpts = {
    encoding: opts.encoding ?? 'Z',
    maxSplit: opts.maxSplit ?? 1295,
    maxVersion: opts.maxVersion ?? 40,
    minSplit: opts.minSplit ?? 1,
    minVersion: opts.minVersion ?? 5
  } as const

  if (
    allOpts.minVersion > allOpts.maxVersion ||
    !isValidVersion(allOpts.minVersion) ||
    !isValidVersion(allOpts.maxVersion)
  ) {
    throw new Error('min/max version out of range')
  }

  if (
    !isValidSplit(allOpts.minSplit) ||
    !isValidSplit(allOpts.maxSplit) ||
    allOpts.minSplit > allOpts.maxSplit
  ) {
    throw new Error('min/max split out of range')
  }

  return allOpts
}

export function versionToChars(v: Version) {
  // return number of **chars** that fit into indicated version QR
  // - assumes L for ECC
  // - assumes alnum encoding

  if (!isValidVersion(v)) {
    throw new Error('Invalid version')
  }

  const ecc = 'L'
  const encoding = 2 // alnum

  return QR_DATA_CAPACITY[v][ecc][encoding]
}

export function encodeData(raw: Uint8Array, encoding: Encoding = 'Z') {
  // return new encoding (if we upgraded) and the
  // characters after encoding (a string)
  // - default is Zlib or if compression doesn't help, base32
  // - returned data can be split, but must be done modX where X provided

  let currentEncoding = encoding
  let currentRaw = raw

  if (currentEncoding === 'H') {
    return {
      encoded: currentRaw
        .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '')
        .toUpperCase(),
      encoding: currentEncoding
    }
  }

  if (currentEncoding === 'Z') {
    // trial compression, but skip if it embiggens the data

    const compressed = pako.deflate(currentRaw, { windowBits: -10 })

    if (compressed.length >= currentRaw.length) {
      currentEncoding = '2'
    } else {
      currentEncoding = 'Z'
      currentRaw = compressed
    }
  }

  return {
    // base32 without padding
    encoded: base32.encode(currentRaw).replace(/=*$/, ''),
    encoding: currentEncoding
  }
}

export function decodeData(parts: string[], encoding: Encoding) {
  // decode the parts back into a Uint8Array

  if (encoding === 'H') {
    return joinByteParts(parts.map((p) => hex.decode(p)))
  }

  const bytes = joinByteParts(
    parts.map((p) => {
      const padding = (8 - (p.length % 8)) % 8

      return base32.decode(p + '='.repeat(padding))
    })
  )

  if (encoding === 'Z') {
    return pako.inflate(bytes, { windowBits: -10 })
  }

  return bytes
}

// EOF
