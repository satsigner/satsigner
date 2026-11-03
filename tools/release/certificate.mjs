import { createHash, createPublicKey } from 'node:crypto'

import { p256 } from '@noble/curves/nist.js'

// Android and Zapstore pin the signing certificate, not only the key, so every
// byte here must come from the phrase. RFC 6979 signing keeps the signature
// fixed too; openssl and node:crypto both use a random ECDSA nonce.
const COMMON_NAME = 'Satsigner release'
const SERIAL = Buffer.from([0x01])
const NOT_BEFORE = '260101000000Z'
const NOT_AFTER = '20760101000000Z'

const TAG_INTEGER = 0x02
const TAG_BIT_STRING = 0x03
const TAG_OID = 0x06
const TAG_UTF8_STRING = 0x0c
const TAG_UTC_TIME = 0x17
const TAG_GENERALIZED_TIME = 0x18
const TAG_SEQUENCE = 0x30
const TAG_SET = 0x31
const TAG_VERSION = 0xa0
const X509_V3 = 0x02

const OID_ECDSA_WITH_SHA256 = Buffer.from('2a8648ce3d040302', 'hex')
const OID_COMMON_NAME = Buffer.from('550403', 'hex')

function derLength(length) {
  if (length < 0x80) {
    return Buffer.from([length])
  }
  const bytes = []
  for (let rest = length; rest > 0; rest >>= 8) {
    bytes.unshift(rest & 0xff)
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

function der(tag, ...parts) {
  const body = Buffer.concat(parts)
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body])
}

function distinguishedName() {
  return der(
    TAG_SEQUENCE,
    der(
      TAG_SET,
      der(
        TAG_SEQUENCE,
        der(TAG_OID, OID_COMMON_NAME),
        der(TAG_UTF8_STRING, Buffer.from(COMMON_NAME))
      )
    )
  )
}

function signatureAlgorithm() {
  return der(TAG_SEQUENCE, der(TAG_OID, OID_ECDSA_WITH_SHA256))
}

function toBeSigned(publicKeyDer) {
  return der(
    TAG_SEQUENCE,
    der(TAG_VERSION, der(TAG_INTEGER, Buffer.from([X509_V3]))),
    der(TAG_INTEGER, SERIAL),
    signatureAlgorithm(),
    distinguishedName(),
    der(
      TAG_SEQUENCE,
      der(TAG_UTC_TIME, Buffer.from(NOT_BEFORE)),
      der(TAG_GENERALIZED_TIME, Buffer.from(NOT_AFTER))
    ),
    distinguishedName(),
    publicKeyDer
  )
}

function selfSignedCertificate(privateKey, secret) {
  const publicKeyDer = createPublicKey(privateKey).export({
    format: 'der',
    type: 'spki'
  })
  const tbs = toBeSigned(publicKeyDer)
  const signature = p256.sign(tbs, secret, { format: 'der' })
  return der(
    TAG_SEQUENCE,
    tbs,
    signatureAlgorithm(),
    der(TAG_BIT_STRING, Buffer.from([0x00]), Buffer.from(signature))
  )
}

function certificatePem(certificateDer) {
  const lines = certificateDer.toString('base64').match(/.{1,64}/g)
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`
}

function certificateFingerprint(certificateDer) {
  return createHash('sha256')
    .update(certificateDer)
    .digest('hex')
    .toUpperCase()
    .match(/../g)
    .join(':')
}

export { certificateFingerprint, certificatePem, selfSignedCertificate }
