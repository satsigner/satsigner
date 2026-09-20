/**
 * (c) Copyright 2024 by Coinkite Inc. This file is in the public domain.
 *
 * Splitting of data and encoding as BBQr QR codes.
 */

import { ENCODING_SPLIT_MOD, HEADER_LEN } from './consts'
import {
  type Encoding,
  type SplitOptions,
  type SplitResult,
  type Version
} from './types'
import {
  encodeData,
  intToBase36,
  validateSplitOptions,
  versionToChars
} from './utils'

function numQRNeeded(version: Version, length: number, encoding: Encoding) {
  const splitMod = ENCODING_SPLIT_MOD[encoding]

  const baseCap = versionToChars(version) - HEADER_LEN

  // adjust capacity to be a multiple of splitMod
  const adjustedCap = baseCap - (baseCap % splitMod)

  const estimatedCount = Math.ceil(length / adjustedCap)

  if (estimatedCount === 1) {
    // if it fits in one QR, we're done
    return { count: 1, perEach: length }
  }

  // the total capacity of our estimated count
  // all but the last QR need to use adjusted capacity to ensure proper split
  const estimatedCap = (estimatedCount - 1) * adjustedCap + baseCap

  return {
    count: estimatedCap >= length ? estimatedCount : estimatedCount + 1,
    perEach: adjustedCap
  }
}

function findBestVersion(length: number, opts: Required<SplitOptions>) {
  const options: { version: Version; count: number; perEach: number }[] = []

  for (
    let version = opts.minVersion;
    version <= opts.maxVersion;
    version += 1
  ) {
    const { count, perEach } = numQRNeeded(version, length, opts.encoding)

    if (opts.minSplit <= count && count <= opts.maxSplit) {
      options.push({ count, perEach, version })
    }
  }

  if (!options.length) {
    throw new Error('Cannot make it fit')
  }

  // pick smallest number of QR, lowest version
  options.sort((a, b) => a.count - b.count || a.version - b.version)

  return options[0]
}

/**
 * Converts the input bytes into a series of QR codes, ensuring that the most efficient QR code
 * version is used.
 *
 * NOTE: When the default 'Z' (Zlib) encoding is selected, it is possible that the actual used encoding
 * will be '2' (Base32) in case Zlib compression does not reduce the size of the output.
 *
 * @param raw The input bytes to split and encode.
 * @param fileType The file type to use. Refer to BBQr spec.
 * @param opts An optional SplitOptions object.
 *
 * @returns An object containing the version of the QR codes, their string parts, and the actual encoding used.
 */
export function splitQRs(
  raw: Uint8Array,
  fileType: string,
  opts: SplitOptions = {}
): SplitResult {
  if (!/^[A-Z]$/.test(fileType)) {
    throw new Error('fileType must be a single uppercase letter A-Z')
  }

  const validatedOpts = validateSplitOptions(opts)

  const { encoding: actualEncoding, encoded } = encodeData(
    raw,
    validatedOpts.encoding
  )

  const { version, count, perEach } = findBestVersion(
    encoded.length,
    validatedOpts
  )

  const parts: string[] = []

  for (
    let n = 0, offset = 0;
    offset < encoded.length;
    n += 1, offset += perEach
  ) {
    parts.push(
      `B$${actualEncoding}${fileType}${intToBase36(count)}${intToBase36(n)}${encoded.slice(offset, offset + perEach)}`
    )
  }

  return { encoding: actualEncoding, parts, version }
}

// EOF
