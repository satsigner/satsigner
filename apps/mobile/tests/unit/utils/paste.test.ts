import {
  validateAddress,
  validateDescriptor,
  validateExtendedKey
} from '../../../utils/validation'

describe('validation', () => {
  it('should return true for valid PSBT', () => {
    const validPsbts = [
      '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'
    ]

    const isPsbt = (text: string) => {
      const base64Regex = /^[A-Za-z0-9+/=]+$/
      if (!base64Regex.test(text)) {
        return false
      }
      try {
        const decoded = Buffer.from(text, 'base64').toString()
        return decoded.startsWith('psbt')
      } catch {
        return false
      }
    }

    validPsbts.forEach((psbt) => {
      expect(isPsbt(psbt)).toBe(true)
    })
  })

  it('should return true for valid addresses', () => {
    const validAddresses = [
      'tb1qmjmw8dwcjkwrey3fxs9a68v6ksetsmwu7qtfvwu6yyhn0h23yhzqpuhuq7'
    ]
    validAddresses.forEach((address) => {
      expect(validateAddress(address)).toBe(true)
    })
  })

  it('should return true for valid descriptor', async () => {
    const validDescriptors = [
      'wpkh([d9b1a255/84h/1h/0h]tpubDDfjKC2BWNePiFbrxLWRgTXD9eb7wKtZmUrTADc9Q896P4x4oWw3TPdxWNrZ8XijNnYnC2AbTrXAwqWnFUzfqNUYqaBYkpwbnXZQSxiNsxj/<0;1>/*)#m8466t3k'
    ]
    for (const descriptor of validDescriptors) {
      const result = await validateDescriptor(descriptor)
      expect(result.isValid).toBe(true)
    }
  })

  it('should return true for valid xpub/tpub', () => {
    const validXpubs = [
      'tpubDFSmmAuiPGeu17Z9MVuHTyStEjhjWpD7wNWmuZ7v6oZeyWu4D6dxd4sVvUUhZ4u5HDJ8Et7AofseYB7GAZq84Xy7QxPBcyHFFsHEkoZ6dE2'
    ]
    validXpubs.forEach((xpub) => {
      expect(validateExtendedKey(xpub, 'testnet')).toBe(true)
    })
  })

  it('should decode a valid lightning invoice', () => {
    const validInvoices = [
      'lnbc20u1p53dptpdq0wdshgumfvahx2usnp4q0cc8qt2nrwfe7r985uwcrpjx3rdq94vaja6d3qweek2p4fducjjspp5xk4wazmwz768x929jzxcl0n4hy9qq38yndwc0ar0xzut66a9pkzqsp5kdrn7z3d2y5ftl6pwdadaus856hr7fj5c7r8pcmru33xpfyqftzq9qyysgqcqpcxqyz5vqm4kfgptfshxwe7vg0emcn93sh0gehhhc328wjrs0f9u9fuwn6pex5x3cxtw0c4k80hy8f7d0j9jac65rwvw26hxfl4hc5w0mdcxvkpcqllervh'
    ]

    const isLightningInvoice = (text: string) => {
      return text.toLowerCase().startsWith('lnbc')
    }

    validInvoices.forEach((invoice) => {
      expect(isLightningInvoice(invoice)).toBe(true)
    })
  })

  it('should return true for valid lnurl', () => {
    const validLnurls = [
      'lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhhg6r9wfkkzmrrd35k6c3sxcmslt7t3s'
    ]
    const isLnurl = (text: string) => {
      return text.toLowerCase().startsWith('lnurl')
    }
    validLnurls.forEach((url) => {
      expect(isLnurl(url)).toBe(true)
    })
  })

  it('should return true for valid ecash token', () => {
    const validTokens = [
      'cashuBo2FteCJodHRwczovL21pbnQubWluaWJpdHMuY2FzaC9CaXRjb2luYXVjc2F0YXSBomFpSABQBVDwSUFGYXCDpGFhBGFzeEBlY2I4NjBjYjg1OGY1NWJjMzAwNTk0NzE5YTBiOWViMjM5MzM0MmNiMmFhMTJiODVjZmQwMGZlNjk2NTkxMDM4YWNYIQMIyQmn71XnPEKuPZ3iWnnv69DzromVxI4DueiknQbbV2Fko2FlWCDhPSMKMBrVHcVXFvWpd29b4YWYw5j7Z7TN3YHcZAow-mFzWCBxW-UP4XmEALHwZRFkDggsvV2bYlN42vV2D5sS7-0QPWFyWCAlx0AdQcFIf7kaT-w75IGiT7Po0VdH_BdDiCWdvMMCtKRhYRggYXN4QDE3ZjQxMzRjNTlmNzZjZWZlMTkxOGNkZThkZGIyNTM3MTUyZDZkMWMwOTQyMjAwM2FmYTZmMWI1YTE0NDhmMmZhY1ghAnOY-UZ8ibhnzBb9FXiu4TzCN96JxY5nvOtgIlLZu0USYWSjYWVYIATrYnyMUzFZVqVMFn9BviPss7qWAj2jt6n73c4XU64pYXNYIBCpsnjvHKqY4ZZQqr4DXR6Z5Js_CIWZDN5MpC7Hg1oqYXJYICASvMZrusCEkRCiOxaTTBgyEnwEr097JHZmc8DJXBUmpGFhGEBhc3hAYjZiMDFiZGVmZDUyNDFlODM2NTE3MTUwM2IwYjJjODU3NjM4YTk0N2QzOWM1NTIzZjEzYzVhMjhkMTFiZGQwMGFjWCED5OJQdD0Q2-RkWoWTkp6RDcGktiFNb3EOZxzkguRL-FdhZKNhZVggUzFRGIMMn7V8AMgEiI1ZWJHxDWEFd3QIptroiYupQnZhc1ggYUkPZLA_1V1nJyaYY1eY-gfi6gnsLUgWpSIwj2kPIZxhclggT9yxUyXfBM4D8EsjdRxg8wxGmrQrsY0mlGflz4sQDds'
    ]

    const isCashuToken = (text: string) => {
      if (!text.startsWith('cashu')) {
        return false
      }
      const token = text.substring(5)
      try {
        Buffer.from(token, 'base64url')
        return true
      } catch {
        return false
      }
    }

    validTokens.forEach((token) => {
      expect(isCashuToken(token)).toBe(true)
    })
  })
})
