/**
 * (c) Copyright 2024 by Coinkite Inc. This file is in the public domain.
 *
 * Main entry point for the library.
 */

import { joinQRs } from './join'
import { detectFileType, splitQRs } from './split'

export * from './types'
export { detectFileType, joinQRs, splitQRs }

// EOF
