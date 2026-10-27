/* SS component kit: one render function per app component, returning HTML strings.
   Props mirror the React Native props so screens read like the app source:

     ss.vstack({ gap: 'lg' },
       ss.text({ size: 'lg', weight: 'medium' }, t('account.name')),
       ss.button({ label: t('common.continue'), variant: 'secondary', go: 'preview' }))

   `go` sets data-go, which screen.js already routes. Needs generated/icons.js. */

const ss = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const cls = (...names) => names.filter(Boolean).join(' ')

  // Shared attributes: go (route), id, class, style, data (object), aria label.
  function attrs(p = {}) {
    const out = []
    if (p.go) out.push(`data-go="${esc(p.go)}"`)
    if (p.id) out.push(`id="${esc(p.id)}"`)
    if (p.style) out.push(`style="${esc(p.style)}"`)
    if (p.label && p.ariaLabel !== false && p.iconOnly) out.push(`aria-label="${esc(p.label)}"`)
    for (const [k, v] of Object.entries(p.data || {})) out.push(`data-${k}="${esc(v)}"`)
    return out.length ? ' ' + out.join(' ') : ''
  }
  const kids = (list) => list.flat(Infinity).filter((c) => c != null && c !== false).join('')

  function icon(name, { width, height, size, className } = {}) {
    const svg = (typeof ssIcons !== 'undefined' && ssIcons[name]) || ''
    if (!svg) console.warn(`ss.icon: unknown icon '${name}'`)
    const w = width ?? size ?? 16
    const h = height ?? size ?? w
    return `<span class="${cls('ss-icon', className)}" style="width:${w}px;height:${h}px" aria-hidden="true">${svg}</span>`
  }

  function text(p = {}, ...children) {
    if (typeof p === 'string') return text({}, p)
    const tag = p.as || 'p'
    return `<${tag} class="${cls(
      'ss-text',
      p.color && p.color !== 'white' && `is-${p.color}`,
      p.size && p.size !== 'sm' && `s-${p.size}`,
      p.weight && p.weight !== 'regular' && `w-${p.weight}`,
      p.type === 'mono' && 'is-mono',
      p.uppercase && 'is-uppercase',
      p.center && 'is-center',
      p.className
    )}"${attrs(p)}>${children.length ? kids(children) : esc(p.text)}</${tag}>`
  }

  const glass = (kind) => `<span class="ss-glass is-${kind}"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></span>`

  function button(p = {}) {
    const v = p.variant || 'default'
    const variant = v === 'default' && p.withSelect ? 'select' : v
    const body = p.loading
      ? '<span class="ss-spinner"></span>'
      : p.icon
        ? `<span class="ss-button-label">${p.icon}</span>`
        : `<span class="ss-button-label">${esc(p.label)}</span>`
    return `<button type="button" class="${cls(
      'ss-button',
      `v-${variant}`,
      p.uppercase !== false && 'is-uppercase',
      p.className
    )}"${p.disabled || p.loading ? ' disabled' : ''}${attrs(p)}>${
      v === 'outline' ? glass('outline') : v === 'elevated' ? glass('elevated') : ''
    }${body}${p.withSelect ? icon('chevronDown', { width: 11.6, height: 5, className: 'ss-select-chevron' }) : ''}</button>`
  }

  function iconButton(p = {}, ...children) {
    return `<button type="button" class="${cls('ss-icon-button', p.rounded && 'is-rounded', p.className)}"${
      p.label ? ` aria-label="${esc(p.label)}"` : ''
    }${attrs(p)}>${kids(children)}</button>`
  }

  // Always set --gap (default md) so nested stacks don't inherit a parent's gap.
  const gapVar = (axis, gap) => `--gap:var(--layout-${axis}-stack-gap-${gap || 'md'});`

  function vstack(p = {}, ...children) {
    return `<div class="${cls('ss-vstack', p.justifyBetween && 'is-between', p.itemsCenter && 'is-center', p.widthFull && 'is-full', p.className)}"${attrs({
      ...p,
      style: gapVar('v', p.gap) + (p.style || '')
    })}>${kids(children)}</div>`
  }

  function hstack(p = {}, ...children) {
    return `<div class="${cls('ss-hstack', p.justifyBetween && 'is-between', p.justifyEvenly && 'is-evenly', p.className)}"${attrs({
      ...p,
      style: gapVar('h', p.gap) + (p.style || '')
    })}>${kids(children)}</div>`
  }

  function mainLayout(p = {}, ...children) {
    return `<div class="${cls('ss-main', p.className)}"${attrs(p)}>${kids(children)}</div>`
  }

  function textInput(p = {}) {
    return `<label class="${cls(
      'ss-input',
      p.variant === 'outline' && 'is-outline',
      p.size === 'small' && 'is-small',
      p.align === 'left' && 'is-left',
      p.status && `is-${p.status}`,
      p.actionRight && 'has-action',
      p.className
    )}"${attrs(p)}>${
      p.multiline
        ? `<textarea rows="4"${p.name ? ` name="${esc(p.name)}"` : ''} placeholder="${esc(p.placeholder)}" class="${p.mono ? 'is-mono' : ''}"${p.readOnly ? ' readonly' : ''}>${esc(p.value)}</textarea>`
        : `<input${p.name ? ` name="${esc(p.name)}"` : ''} value="${esc(p.value)}" placeholder="${esc(p.placeholder)}"${p.readOnly ? ' readonly' : ''}${
            p.inputMode ? ` inputmode="${esc(p.inputMode)}"` : ''
          }>`
    }${
      p.actionRight ? `<span class="ss-input-action">${p.actionRight}</span>` : ''
    }${p.error ? `<p class="ss-input-note is-error">${esc(p.error)}</p>` : ''}${
      p.warning ? `<p class="ss-input-note is-warning">${esc(p.warning)}</p>` : ''
    }</label>`
  }

  function checkbox(p = {}) {
    return `<button type="button" role="checkbox" aria-checked="${!!p.selected}" class="${cls('ss-checkbox', p.selected && 'is-on', p.className)}"${
      p.disabled ? ' disabled' : ''
    } data-ss-toggle${attrs(p)}><span class="ss-checkbox-box"></span>${
      p.label
        ? `<span class="ss-checkbox-copy">${text({ size: 'lg', color: p.disabled ? 'muted' : 'white', as: 'span' }, esc(p.label))}${
            p.description ? text({ color: 'muted', as: 'span' }, esc(p.description)) : ''
          }</span>`
        : ''
    }</button>`
  }

  // Radio buttons with the same `group` deselect each other.
  function radio(p = {}) {
    return `<button type="button" role="radio" aria-checked="${!!p.selected}" class="${cls(
      'ss-radio',
      p.variant === 'outline' && 'is-outline',
      p.selected && 'is-on',
      p.className
    )}"${p.disabled ? ' disabled' : ''}${p.group ? ` data-ss-radio="${esc(p.group)}"` : ''}${attrs(p)}>${
      p.variant === 'outline' ? glass('outline') : ''
    }${p.loading ? '<span class="ss-spinner"></span>' : `<span>${esc(p.label)}</span>`}</button>`
  }

  function separator(p = {}) {
    return `<div class="${cls('ss-separator', p.color === 'grayDark' && 'is-dark', p.className)}"${attrs(p)}></div>`
  }

  function form(p = {}, ...children) {
    return `<div class="${cls('ss-form', p.className)}"${attrs(p)}>${kids(children)}</div>`
  }
  form.item = (p = {}, ...children) => `<div class="${cls('ss-form-item', p.className)}"${attrs(p)}>${kids(children)}</div>`
  form.label = (p = {}) => `<p class="ss-form-label">${esc(p.label)}</p>`

  function loader() {
    return '<span class="ss-spinner" role="status" aria-label="Loading"></span>'
  }

  // Modals start hidden; open with ss.open(id). The close button runs ss.close.
  function modal(p = {}, ...children) {
    const close = p.showLabel === false ? '' : button({ label: p.label || t('common.cancel'), variant: p.closeButtonVariant || 'ghost', data: { 'ss-close': '' } })
    return `<div class="${cls('ss-modal', p.fullOpacity && 'is-opaque')}" id="${esc(p.id)}"${p.visible ? '' : ' hidden'}>${vstack(
      { justifyBetween: true, itemsCenter: true },
      kids(children),
      close
    )}</div>`
  }

  function clipboardCopy(p = {}, ...children) {
    return `<span class="ss-copy" data-ss-copy="${esc(p.text)}">${kids(children)}</span>`
  }

  // --- behaviour (one delegated listener for everything the kit renders) ---

  function toast(message, host) {
    const root = host || document.querySelector('.phone, .screen, body')
    const el = document.createElement('div')
    el.className = 'ss-toast'
    el.textContent = message
    root.appendChild(el)
    setTimeout(() => el.remove(), 1600)
  }

  const open = (id) => document.getElementById(id)?.removeAttribute('hidden')
  const close = (id) => document.getElementById(id)?.setAttribute('hidden', '')

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-ss-toggle]')
    if (toggle && !toggle.disabled) {
      const on = toggle.classList.toggle('is-on')
      toggle.setAttribute('aria-checked', on)
    }
    const r = e.target.closest('[data-ss-radio]')
    if (r && !r.disabled) {
      const scope = r.closest('.ss-vstack, .ss-hstack, section, body')
      scope.querySelectorAll(`[data-ss-radio="${r.dataset.ssRadio}"]`).forEach((b) => {
        b.classList.toggle('is-on', b === r)
        b.setAttribute('aria-checked', b === r)
      })
    }
    const c = e.target.closest('[data-ss-close]')
    if (c) c.closest('.ss-modal')?.setAttribute('hidden', '')
    const copy = e.target.closest('[data-ss-copy]')
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.ssCopy).catch(() => {})
      toast(t('common.copiedToClipboard'), copy.closest('.ss-main, section') || undefined)
    }
  })


  // --- amounts, addresses, details (batch 2) ---

  const PRIVACY_MASK = '••••'
  const fmt = (n, decimals = 0, pad = false) => {
    const v = Number(n).toLocaleString('en-US', { minimumFractionDigits: pad ? decimals : 0, maximumFractionDigits: decimals })
    return v
  }
  // Fixture price used by amount inputs; screens may overwrite ss.price.
  const price = { fiat: 'USD', btc: 100000 }
  const satsToFiat = (sats) => (sats / 1e8) * price.btc

  // SSStyledSatText: leading zeros dimmed, digits spaced in threes, red/green for send/receive.
  function styledSat(p = {}) {
    const size = p.textSize || '3xl'
    const pad = p.useZeroPadding || p.currency === 'btc'
    const decimals = p.decimals ?? (p.currency === 'btc' ? 8 : 0)
    const raw = Number(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: pad ? decimals : 0, maximumFractionDigits: decimals, useGrouping: false })
    const spaced = raw.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')
    const i = spaced.search(/[1-9]/) === -1 ? spaced.length : spaced.search(/[1-9]/)
    const lead = spaced.slice(0, i)
    const rest = spaced.slice(i)
    const noColor = p.noColor !== false
    const type = p.type || 'send'
    const tone = noColor ? '' : ` is-${type}`
    return `<span class="ss-text ss-sat s-${size}${p.weight ? ` w-${p.weight}` : ''}${tone}${pad && lead ? ' is-padded' : ''}">${
      type === 'send' && !noColor && p.showSign !== false ? '<span class="ss-sat-sign">-</span>' : ''
    }${lead ? `<span class="ss-sat-lead">${lead}</span>` : ''}${rest ? `<span class="ss-sat-main">${rest}</span>` : ''}</span>`
  }

  // SSAmountDisplay: amount + muted unit, masked in privacy mode. Returns inline siblings.
  function amountDisplay(p = {}) {
    const size = p.textSize || '3xl'
    const value = p.privacyMode ? `<span class="ss-text s-${size}">${PRIVACY_MASK}</span>` : styledSat({ ...p, textSize: size })
    return `${value}<span class="ss-text is-muted s-${p.unitSize || 'sm'}">${p.currency === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}</span>`
  }

  // SSAddressDisplay: address in 4-char mono groups, copy on tap.
  function addressDisplay(p = {}) {
    const groups = (String(p.address).match(/.{1,4}/g) || []).map((g) => text({ type: 'mono', size: p.size || 'md', as: 'span' }, esc(g)))
    const body = `<div class="ss-address is-${p.variant || 'default'}">${groups.join('')}</div>`
    return p.copyToClipboard === false ? body : clipboardCopy({ text: p.address }, body)
  }

  // SSDetailsList: items are [header, text, options?].
  function detailsList(p = {}) {
    const width = `${Math.floor(100 / (p.columns || 1))}%`
    const items = (p.items || []).map(([header, value, o = {}]) => {
      const opt = { headerSize: 'sm', textSize: 'xs', uppercase: true, variant: 'sans-serif', ...p, ...o }
      const valid = value !== undefined && value !== ''
      const inner = vstack({ gap: opt.variant === 'mono' ? 'sm' : 'none' },
        text({ uppercase: opt.uppercase, color: 'muted', size: opt.headerSize }, esc(header)),
        hstack({ gap: 'xs', style: 'align-items:baseline' },
          text({ type: opt.variant === 'mono' ? 'mono' : undefined, size: opt.textSize }, valid ? esc(value) : '-'),
          valid && opt.unit ? text({ color: 'muted', size: opt.textSize }, esc(opt.unit)) : ''))
      return `<div style="width:${o.width || width}">${opt.copyToClipboard && valid ? clipboardCopy({ text: value }, inner) : inner}</div>`
    })
    return `<div class="ss-details" style="row-gap:${p.gap ?? 8}px">${items.join('')}</div>`
  }

  // SSActionButton: bare 62px pressable row (used for account action bars).
  function actionButton(p = {}, ...children) {
    return `<button type="button" class="${cls('ss-action-button', p.className)}"${attrs(p)}>${kids(children)}</button>`
  }

  // SSQRCode: deterministic fake QR (no real encoding — prototype only).
  function qr(p = {}) {
    const n = 29
    const cells = new Array(n * n).fill(0)
    const reserved = new Array(n * n).fill(false)
    const finder = (x, y) => {
      for (let r = -1; r < 8; r++)
        for (let c = -1; c < 8; c++) {
          const X = x + c, Y = y + r
          if (X < 0 || Y < 0 || X >= n || Y >= n) continue
          const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
          const on = inside && (r === 0 || c === 0 || r === 6 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          cells[Y * n + X] = on ? 1 : 0
          reserved[Y * n + X] = true
        }
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7)
    let h = 2166136261
    for (const ch of String(p.value)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
    for (let i = 0; i < cells.length; i++) {
      if (reserved[i]) continue
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0
      cells[i] = (h >>> 24) & 1
    }
    const rects = cells.map((on, i) => (on ? `<rect x="${i % n}" y="${Math.floor(i / n)}" width="1.02" height="1.02"/>` : '')).join('')
    const size = p.size || 220
    return `<div class="ss-qr" style="width:${size}px;height:${size}px"><svg viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="QR code">${rects}</svg></div>`
  }

  // SSShareableQR: QR + optional children + share button.
  function shareableQR(p = {}, ...children) {
    return vstack({ itemsCenter: true, gap: 'md' }, qr(p), kids(children),
      p.hideShareButton ? '' : button({ label: t('common.share'), variant: 'outline', data: { 'ss-copy': p.value } }))
  }

  // SSAmountInput: ghost number (tap to edit), fiat toggle, min/max row and slider.
  function amountInput(p = {}) {
    const min = p.min ?? 546
    const max = p.max ?? 100000
    const v = Math.min(max, Math.max(min, p.value ?? min))
    return `<div class="ss-amount-input" data-ss-amount data-min="${min}" data-max="${max}" data-remaining="${p.remainingSats ?? ''}">
      <label class="ss-ghost-input"><span class="ss-ghost-value">${hstack({ gap: 'xs', style: 'align-items:baseline;justify-content:center' },
        text({ size: '5xl', weight: 'light', as: 'span', className: 'ss-amount-value' }, fmt(v)),
        text({ color: 'muted', size: 'lg', as: 'span', className: 'ss-amount-unit' }, t('bitcoin.sats')))}</span>
        <input class="ss-ghost-field" inputmode="numeric" value="${v}" hidden></label>
      ${hstack({ gap: 'xs', style: 'justify-content:center' }, text({ color: 'muted', size: 'lg', className: 'ss-amount-fiat is-switchable' }, `${fmt(satsToFiat(v), 2, true)} ${price.fiat}`))}
      ${hstack({ justifyBetween: true },
        hstack({ gap: 'xs' }, text({}, String(min)), text({ color: 'muted' }, t('bitcoin.sats'))),
        p.remainingSats !== undefined ? text({ color: 'muted', className: 'ss-amount-remaining' }, `${t('common.remaining')} ${fmt(p.remainingSats - v)} ${t('bitcoin.sats')}`) : '',
        hstack({ gap: 'xs' }, text({}, String(max)), text({ color: 'muted' }, t('bitcoin.sats'))))}
      <input type="range" class="ss-slider" min="${min}" max="${max}" step="1" value="${v}" style="--fill:${((v - min) / (max - min || 1)) * 100}%">
    </div>`
  }

  function syncAmount(root, sats, fromSlider) {
    const min = +root.dataset.min, max = +root.dataset.max
    sats = Math.min(max, Math.max(min, Math.round(sats) || min))
    root.querySelector('.ss-amount-value').textContent = fmt(sats)
    root.querySelector('.ss-ghost-field').value = sats
    if (!fromSlider) root.querySelector('.ss-slider').value = sats
    root.querySelector('.ss-slider').style.setProperty('--fill', `${((sats - min) / (max - min || 1)) * 100}%`)
    const fiat = root.querySelector('.ss-amount-fiat')
    if (!root.classList.contains('is-fiat')) fiat.textContent = `${fmt(satsToFiat(sats), 2, true)} ${price.fiat}`
    else fiat.textContent = `${fmt(sats)} ${t('bitcoin.sats')}`
    const rem = root.querySelector('.ss-amount-remaining')
    if (rem) rem.textContent = `${t('common.remaining')} ${fmt(+root.dataset.remaining - sats)} ${t('bitcoin.sats')}`
    root.dataset.value = sats
    root.dispatchEvent(new CustomEvent('ss-change', { bubbles: true, detail: { sats } }))
  }

  document.addEventListener('input', (e) => {
    const root = e.target.closest('[data-ss-amount]')
    if (root && e.target.matches('.ss-slider')) syncAmount(root, +e.target.value, true)
  })
  document.addEventListener('click', (e) => {
    const root = e.target.closest('[data-ss-amount]')
    if (!root) return
    if (e.target.closest('.ss-ghost-value')) {
      const field = root.querySelector('.ss-ghost-field')
      root.querySelector('.ss-ghost-value').hidden = true
      field.hidden = false
      field.focus()
      field.select()
    }
    if (e.target.closest('.ss-amount-fiat')) {
      root.classList.toggle('is-fiat')
      syncAmount(root, +root.querySelector('.ss-ghost-field').value)
    }
  })
  document.addEventListener('focusout', (e) => {
    const root = e.target.closest?.('[data-ss-amount]')
    if (!root || !e.target.matches('.ss-ghost-field')) return
    syncAmount(root, +e.target.value)
    e.target.hidden = true
    root.querySelector('.ss-ghost-value').hidden = false
  })

  // --- sign / broadcast (batch 3) ---

  // SSLoader: two dots orbiting with a depth scale. One rAF loop drives every loader on the page.
  function orbitLoader(p = {}) {
    const size = p.size || 80
    return `<span class="ss-orbit" style="width:${size}px;height:${size}px" role="status" aria-label="Loading"><svg viewBox="0 0 120 60" width="${size}" height="${size}" preserveAspectRatio="xMidYMid"><circle cx="82" cy="30" r="12"/><circle cx="38" cy="30" r="12"/></svg></span>`
  }
  ;(function orbit() {
    const a = ((performance.now() % 1500) / 1500) * 2 * Math.PI
    document.querySelectorAll('.ss-orbit svg').forEach((svg) => {
      const [c1, c2] = svg.children
      for (const [c, o] of [[c1, a], [c2, a + Math.PI]]) {
        c.setAttribute('cx', 60 + 22 * Math.cos(o))
        c.setAttribute('cy', 30 - 22 * Math.sin(o))
        c.setAttribute('r', 12 * (1 - 0.85 * Math.sin(o)))
      }
    })
    requestAnimationFrame(orbit)
  })()

  // SSSuccessCheckAnimation: pulse rings, glowing disc, check drawn in. Simplified from the
  // reanimated version (same geometry, timings and colours).
  let successId = 0
  function successCheck(p = {}) {
    const size = p.size || 159
    const id = `ss-success-${++successId}`
    // SSIconSuccess outline: signed, not yet broadcast. Ring and check, no filled disc.
    if (p.variant === 'outline') {
      return `<span class="ss-success is-outline" style="width:${size}px;height:${size}px">
        <svg viewBox="-22 -22 204 204" width="${size}" height="${size}" fill="none">
          <defs>
            <radialGradient id="${id}-rim" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff" stop-opacity="0"/><stop offset="48%" stop-color="#fff" stop-opacity="0"/>
              <stop offset="72%" stop-color="#fff" stop-opacity="0.05"/><stop offset="88%" stop-color="#fff" stop-opacity="0.11"/>
              <stop offset="100%" stop-color="#fff" stop-opacity="0.15"/>
            </radialGradient>
            <radialGradient id="${id}-center" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff" stop-opacity="0.14"/><stop offset="38%" stop-color="#fff" stop-opacity="0.05"/>
              <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="80" cy="80" r="70" fill="url(#${id}-rim)"/>
          <circle cx="80" cy="80" r="70" fill="url(#${id}-center)"/>
          <circle cx="80" cy="80" r="72" fill="none" stroke="#fff" stroke-opacity="0.52" stroke-width="1.2"/>
          <path d="M44 81 L69 106 L116 52" stroke="#fff" stroke-opacity="0.52" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
        </svg></span>`
    }
    return `<span class="ss-success${p.static ? ' is-static' : ''}" style="width:${size}px;height:${size}px">
      <i class="ss-success-ring"></i><i class="ss-success-ring is-late"></i>
      <svg viewBox="-44 -44 248 248" width="${size}" height="${size}" fill="none">
        <defs>
          <radialGradient id="${id}-halo" cx="80" cy="80" r="152" gradientUnits="userSpaceOnUse">
            <stop offset="48%" stop-color="#fff" stop-opacity="0"/><stop offset="62%" stop-color="#fff" stop-opacity="0.045"/>
            <stop offset="74%" stop-color="#fff" stop-opacity="0.075"/><stop offset="84%" stop-color="#fff" stop-opacity="0.09"/>
            <stop offset="93%" stop-color="#fff" stop-opacity="0.065"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${id}-disc" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff"/><stop offset="48%" stop-color="#fff" stop-opacity="0.95"/><stop offset="100%" stop-color="#fff" stop-opacity="0.84"/>
          </radialGradient>
        </defs>
        <circle class="ss-success-halo" cx="80" cy="80" r="111" fill="url(#${id}-halo)"/>
        <g transform="translate(80 80) scale(1.222) translate(-80 -80)">
          <circle cx="80" cy="80" r="72" fill="url(#${id}-disc)"/>
          <circle cx="80" cy="80" r="72" stroke="var(--gray-50)" stroke-width="1.2"/>
          <path class="ss-success-check" d="M44 81 L69 106 L116 52" stroke="var(--gray-200)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </svg></span>`
  }

  // SSTransactionIdFormatted: 64-hex txid as byte pairs, alternating white/gray every 2 bytes.
  function txid(p = {}) {
    const v = String(p.value || '').replace(/\s+/g, '')
    if (!/^[0-9a-fA-F]{64}$/.test(v)) return text({ size: p.size || 'lg', style: 'letter-spacing:0.5px' }, esc(v))
    const bytes = v.match(/../g)
    return `<div class="ss-txid s-${p.size || 'lg'}">${bytes.map((b, i) => `<span${Math.floor(i / 2) % 2 ? ' class="is-dim"' : ''}>${b}</span>`).join('')}</div>`
  }

  // Shorten like utils formatAddress: first 8 … last 8.
  const shortId = (v, n = 8) => (v.length > n * 2 + 3 ? `${v.slice(0, n)}...${v.slice(-n)}` : v)

  // --- send builder (batch 4) ---

  // SSBottomSheet: slides up over the screen, 50% snap by default, tap the scrim or a
  // [data-ss-close] to dismiss. Open with ss.open(id).
  function bottomSheet(p = {}, ...children) {
    return `<div class="ss-sheet" id="${esc(p.id)}" hidden><div class="ss-sheet-scrim" data-ss-close></div><div class="ss-sheet-panel${
      p.paddingX === false ? ' is-flush' : ''
    }" style="height:${p.height || '50%'}">${vstack({}, text({ uppercase: true, center: true }, esc(p.title)), kids(children))}</div></div>`
  }

  // SSFeeInput: ghost sat/vB value, min/fee/blocks/max row, slider. Fires ss-change with { rate }.
  function feeInput(p = {}) {
    const max = p.max || 100
    const min = p.min || 1
    const v = Math.max(min, p.value || min)
    const vb = p.vbytes || 0
    return `<div class="ss-fee-input" data-ss-fee data-min="${min}" data-max="${max}" data-vbytes="${vb}">
      <label class="ss-ghost-input"><span class="ss-ghost-value">${hstack({ gap: 'xs', style: 'align-items:baseline;justify-content:center' },
        text({ size: '5xl', weight: 'light', as: 'span', className: 'ss-fee-value' }, fmt(v, 2)),
        text({ color: 'muted', size: 'lg', as: 'span' }, t('bitcoin.satVb')))}</span>
        <input class="ss-ghost-field" inputmode="decimal" value="${v}" hidden></label>
      ${hstack({ justifyBetween: true },
        hstack({ gap: 'xs' }, text({}, String(min)), text({ color: 'muted' }, t('bitcoin.sat'))),
        hstack({ gap: 'md' },
          hstack({ gap: 'xxs' }, text({ className: 'ss-fee-sats' }, String(Math.trunc(vb * v))), text({ color: 'muted' }, t('bitcoin.sats'))),
          hstack({ gap: 'xxs' }, text({ className: 'ss-fee-fiat' }, fmt(satsToFiat(Math.trunc(vb * v)), 2, true)), text({ color: 'muted' }, price.fiat))),
        hstack({ gap: 'xs' }, text({}, String(max)), text({ color: 'muted' }, t('bitcoin.satVb'))))}
      <input type="range" class="ss-slider" min="${min}" max="${max}" step="0.1" value="${v}" style="--fill:${((v - min) / (max - min)) * 100}%">
    </div>`
  }

  function syncFee(root, rate, fromSlider) {
    const max = +root.dataset.max
    const min = +(root.dataset.min || 1)
    rate = Math.min(max, Math.max(min, Math.round((+rate || min) * 10) / 10))
    const vb = +root.dataset.vbytes
    root.querySelector('.ss-fee-value').textContent = fmt(rate, 2)
    root.querySelector('.ss-ghost-field').value = rate
    const slider = root.querySelector('.ss-slider')
    if (!fromSlider) slider.value = rate
    slider.style.setProperty('--fill', `${((rate - min) / (max - min)) * 100}%`)
    root.querySelector('.ss-fee-sats').textContent = Math.trunc(vb * rate)
    root.querySelector('.ss-fee-fiat').textContent = fmt(satsToFiat(Math.trunc(vb * rate)), 2, true)
    root.dataset.value = rate
  }

  document.addEventListener('input', (e) => {
    const root = e.target.closest('[data-ss-fee]')
    if (root && e.target.matches('.ss-slider')) syncFee(root, +e.target.value, true)
  })
  document.addEventListener('click', (e) => {
    const root = e.target.closest('[data-ss-fee]')
    if (root && e.target.closest('.ss-ghost-value')) {
      const field = root.querySelector('.ss-ghost-field')
      root.querySelector('.ss-ghost-value').hidden = true
      field.hidden = false
      field.focus()
      field.select()
    }
    const close = e.target.closest('.ss-sheet [data-ss-close]')
    if (close) close.closest('.ss-sheet').setAttribute('hidden', '')
  })
  document.addEventListener('focusout', (e) => {
    const root = e.target.closest?.('[data-ss-fee]')
    if (!root || !e.target.matches('.ss-ghost-field')) return
    syncFee(root, +e.target.value)
    e.target.hidden = true
    root.querySelector('.ss-ghost-value').hidden = false
  })

  // SSSettingsCards — components/SSSettingsCard.tsx: icon, title, description, chevron.
  function settingsCard(p = {}) {
    return `<button type="button" class="ss-settings-card"${attrs(p)}>${hstack({ justifyBetween: true },
      hstack({ style: 'align-items:center;width:94%' },
        p.icon || '',
        vstack({ gap: 'none', style: 'flex-shrink:1' }, text({ size: 'lg' }, esc(p.title)), text({ color: 'muted' }, esc(p.description)))),
      icon('chevronRight', { width: 6, height: 11.6 }))}</button>`
  }

  return { settingsCard, bottomSheet, feeInput, orbitLoader, successCheck, txid, shortId, price, PRIVACY_MASK, styledSat, amountDisplay, addressDisplay, detailsList, actionButton, qr, shareableQR, amountInput, esc, icon, text, button, iconButton, vstack, hstack, mainLayout, textInput, checkbox, radio, separator, form, loader, modal, clipboardCopy, toast, open, close }
})()
