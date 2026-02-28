/**
 * (c) Copyright 2024 by Coinkite Inc. This file is in the public domain.
 *
 * Types
 */

import {
  type ENCODING_NAMES,
  type FILETYPE_NAMES,
  type QR_DATA_CAPACITY
} from './consts'

export type FileType = keyof typeof FILETYPE_NAMES
export type Encoding = keyof typeof ENCODING_NAMES
export type Version = keyof typeof QR_DATA_CAPACITY

export type SplitOptions = {
  /**
   * The encoding to use for the split.
   * @default 'Z'
   */
  encoding?: Encoding
  /**
   * The minimum number of QR codes to use.
   * @default 1
   */
  minSplit?: number
  /**
   * The maximum number of QR codes to use.
   * @default 1295
   */
  maxSplit?: number
  /**
   * The minimum version of QR code to use.
   * @default 5
   */
  minVersion?: Version
  /**
   * The maximum version of QR code to use.
   * @default 40
   */
  maxVersion?: Version
}

export type SplitResult = {
  version: Version
  parts: string[]
  encoding: Encoding
}

export type JoinResult = {
  fileType: string
  encoding: Encoding
  raw: Uint8Array
}

// EOF
