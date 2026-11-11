type DescriptorPdfSection = {
  descriptor: string
  qrDataUrl: string
}

const HTML_ENTITIES: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  "'": '&#39;',
  '<': '&lt;',
  '>': '&gt;'
}

const DESCRIPTOR_PDF_STYLE = `
  @page {
    margin: 1in;
    size: A4;
  }

  body {
    font-family: 'Courier New', monospace;
    margin: 0;
    padding: 20px;
    background-color: white;
    color: black;
    line-height: 1.4;
  }

  .header {
    text-align: center;
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 30px;
  }

  .qr-section {
    text-align: center;
    margin: 30px 0;
    page-break-inside: avoid;
  }

  .qr-code {
    max-width: 300px;
    max-height: 300px;
    border: 2px solid #000;
    margin: 0 auto;
    display: block;
  }

  .descriptor-text {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    word-break: break-all;
    white-space: pre-wrap;
    background-color: #f8f8f8;
    padding: 20px;
    border: 1px solid #ddd;
    margin: 15px 0;
    line-height: 1.6;
  }
`

function escapeHtml(text: string) {
  return text.replaceAll(/["&'<>]/g, (char) => HTML_ENTITIES[char] ?? char)
}

function sectionHtml({ descriptor, qrDataUrl }: DescriptorPdfSection) {
  const qr = qrDataUrl
    ? `<div class="qr-section"><img src="${escapeHtml(qrDataUrl)}" class="qr-code" alt="QR Code for descriptor" /></div>`
    : ''
  return `${qr}<div class="descriptor-text">${escapeHtml(descriptor)}</div>`
}

/** A printable page with each descriptor's QR code above its text. */
function buildDescriptorsPdfHtml(
  title: string,
  sections: DescriptorPdfSection[]
) {
  const safeTitle = escapeHtml(title)
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <style>${DESCRIPTOR_PDF_STYLE}</style>
  </head>
  <body>
    <div class="header">${safeTitle}</div>
    ${sections.map(sectionHtml).join('\n')}
  </body>
</html>`
}

export { buildDescriptorsPdfHtml, type DescriptorPdfSection }
