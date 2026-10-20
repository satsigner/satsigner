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

  const gapVar = (axis, gap) => (gap ? `--gap:var(--layout-${axis}-stack-gap-${gap});` : '')

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
    )}"${attrs(p)}><input${p.name ? ` name="${esc(p.name)}"` : ''} value="${esc(p.value)}" placeholder="${esc(p.placeholder)}"${
      p.readOnly ? ' readonly' : ''
    }${p.inputMode ? ` inputmode="${esc(p.inputMode)}"` : ''}>${
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

  return { esc, icon, text, button, iconButton, vstack, hstack, mainLayout, textInput, checkbox, radio, separator, form, loader, modal, clipboardCopy, toast, open, close }
})()
