import { buildDescriptorsPdfHtml } from '@/utils/descriptorPdf'

const EXTERNAL = 'wpkh([73c5da0a/84h/1h/0h]tpubD6NzVbkrYhZ4X/0/*)#abc'
const INTERNAL = 'wpkh([73c5da0a/84h/1h/0h]tpubD6NzVbkrYhZ4X/1/*)#def'

describe('buildDescriptorsPdfHtml', () => {
  it('puts each descriptor under its own QR code', () => {
    const html = buildDescriptorsPdfHtml('Savings', [
      { descriptor: EXTERNAL, qrDataUrl: 'data:image/png;base64,EXT' },
      { descriptor: INTERNAL, qrDataUrl: 'data:image/png;base64,INT' }
    ])

    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html.indexOf('base64,EXT')).toBeLessThan(html.indexOf(EXTERNAL))
    expect(html.indexOf(EXTERNAL)).toBeLessThan(html.indexOf('base64,INT'))
    expect(html.indexOf('base64,INT')).toBeLessThan(html.indexOf(INTERNAL))
  })

  it('names each section', () => {
    const html = buildDescriptorsPdfHtml('Savings', [
      { descriptor: EXTERNAL, label: 'External Descriptor', qrDataUrl: '' },
      { descriptor: INTERNAL, label: 'Internal Descriptor', qrDataUrl: '' }
    ])

    expect(html.indexOf('External Descriptor')).toBeLessThan(
      html.indexOf(EXTERNAL)
    )
    expect(html.indexOf('Internal Descriptor')).toBeLessThan(
      html.indexOf(INTERNAL)
    )
  })

  it('keeps the text of a descriptor whose QR could not be captured', () => {
    const html = buildDescriptorsPdfHtml('Savings', [
      { descriptor: EXTERNAL, qrDataUrl: '' }
    ])

    expect(html).not.toContain('<img')
    expect(html).toContain(EXTERNAL)
  })

  it('escapes the account name and descriptor text', () => {
    const html = buildDescriptorsPdfHtml('<b>Cold</b> & "safe"', [
      { descriptor: 'wsh(sortedmulti(2,A/<0;1>/*))', qrDataUrl: '' }
    ])

    expect(html).toContain('&lt;b&gt;Cold&lt;/b&gt; &amp; &quot;safe&quot;')
    expect(html).toContain('A/&lt;0;1&gt;/*')
    expect(html).not.toContain('<b>Cold')
  })
})
