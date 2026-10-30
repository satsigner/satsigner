/* Store and social artboards at the sizes those surfaces accept. */
const distributionView = document.getElementById('distribution-view')

const shots = [
  {
    screen: 'coins',
    title: 'See every sat.',
    sub: 'Size, age, and labels\nfor every coin you hold.'
  },
  {
    screen: 'send',
    title: 'Build the transaction.',
    sub: 'Fees, RBF, time-locks,\nand the outputs you choose.'
  },
  {
    screen: 'multisig-settings',
    title: 'Sign together.',
    sub: 'M-of-N wallets,\npolicy, and every key.'
  },
  {
    screen: 'account',
    title: 'One balance. Every account.',
    sub: 'Single-sig, multisig,\nand watch-only.'
  },
  {
    screen: 'psbt-qr',
    title: 'Sign off-line.',
    sub: 'Animated QR for an\nair-gapped signer.'
  },
  {
    screen: 'account-receive',
    title: 'A new address.',
    sub: 'Fresh receive address\nand a QR, every time.'
  },
  {
    screen: 'settings-network-server',
    title: 'Your own node.',
    sub: 'Electrum or Esplora.\nNothing in between.'
  },
  {
    screen: 'nostr',
    title: 'Messages, too.',
    sub: 'Nostr from the same\nkeys you already hold.'
  }
]

function phone(screen) {
  const wrap = document.createElement('div')
  wrap.className = 'promo-phone'
  const iframe = document.createElement('iframe')
  iframe.title = ''
  iframe.tabIndex = -1
  iframe.setAttribute('aria-hidden', 'true')
  iframe.loading = 'lazy'
  iframe.src = '/studio/?embed=1&device=1&still=1&screen=' + encodeURIComponent(screen)
  wrap.appendChild(iframe)
  return wrap
}

function copyBlock(kicker, title, sub, logo) {
  const copy = document.createElement('div')
  copy.className = 'promo-copy'
  if (kicker) {
    const mark = document.createElement('p')
    mark.className = 'promo-kicker'
    if (logo) {
      const img = document.createElement('img')
      img.src = '/imgs/satSigner_symbol.png'
      img.alt = ''
      mark.appendChild(img)
    }
    mark.appendChild(document.createTextNode(kicker))
    copy.appendChild(mark)
  }
  const h = document.createElement('h3')
  h.className = 'promo-headline'
  title.split('\n').forEach((line, i) => {
    if (i) h.appendChild(document.createElement('br'))
    h.appendChild(document.createTextNode(line))
  })
  const p = document.createElement('p')
  p.className = 'promo-sub'
  sub.split('\n').forEach((line, i) => {
    if (i) p.appendChild(document.createElement('br'))
    p.appendChild(document.createTextNode(line))
  })
  copy.appendChild(h)
  copy.appendChild(p)
  return copy
}

function board(className, scale, node) {
  const slot = document.createElement('figure')
  slot.className = 'promo-slot'
  const scaleWrap = document.createElement('div')
  scaleWrap.className = 'promo-scale'
  const w = node.dataset.w
  const h = node.dataset.h
  scaleWrap.style.width = (w * scale) + 'px'
  scaleWrap.style.height = (h * scale) + 'px'
  node.className = 'promo-board ' + className
  node.style.transform = 'scale(' + scale + ')'
  scaleWrap.append(node, actionBar(jpgButton(), compareButton()))
  const cap = document.createElement('figcaption')
  const label = document.createElement('span')
  label.textContent = node.dataset.caption
    ? node.dataset.caption + ' · ' + w + ' × ' + h
    : w + ' × ' + h
  cap.appendChild(label)
  slot.append(scaleWrap, cap)
  return slot
}

function frame(visual, ...nodes) {
  const box = document.createElement('div')
  box.className = 'promo-frame'
  box.append(visual, actionBar(...nodes))
  return box
}

function actionBar(...nodes) {
  const bar = document.createElement('div')
  bar.className = 'promo-actions'
  bar.append(...nodes)
  return bar
}

function jpgButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'promo-jpg'
  button.textContent = 'JPG'
  button.addEventListener('click', () => exportJpg(button))
  return button
}

function compareButton() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'promo-jpg'
  button.textContent = 'Compare'
  button.addEventListener('click', () => showCheck(button.closest('.promo-slot')))
  return button
}

function fileSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function wideBoard(className, scale, kicker, title, sub, screen, w, h, logo, file, caption) {
  const node = document.createElement('div')
  node.dataset.w = w
  node.dataset.h = h
  node.dataset.file = file
  if (caption) node.dataset.caption = caption
  node.appendChild(copyBlock(kicker, title, sub, logo))
  node.appendChild(phone(screen))
  return board(className, scale, node)
}

function sphereBoard(className, scale, w, h, file, caption) {
  const node = document.createElement('div')
  node.dataset.w = w
  node.dataset.h = h
  node.dataset.file = file
  if (caption) node.dataset.caption = caption
  const sphere = document.createElement('div')
  sphere.className = 'promo-orb-sphere'
  sphere.setAttribute('aria-hidden', 'true')
  const grain = document.createElement('canvas')
  grain.className = 'promo-orb-grain'
  grain.setAttribute('aria-hidden', 'true')
  grain.width = w
  grain.height = h
  const pixels = grain.getContext('2d').createImageData(w, h)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const n = 96 + ((Math.random() * 48) | 0)
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = n
    pixels.data[i + 3] = 255
  }
  grain.getContext('2d').putImageData(pixels, 0, 0)
  const copy = copyBlock('SATSIGNER', 'See every sat.\nControl every key.', 'Clear, private, and yours.')
  node.append(sphere, grain, copy)
  return board(className, scale, node)
}

function shotBoard(className, scale, shot, w, h, file) {
  const node = document.createElement('div')
  node.dataset.w = w
  node.dataset.h = h
  node.dataset.file = file
  node.appendChild(copyBlock('', shot.title, shot.sub))
  node.appendChild(phone(shot.screen))
  return board(className, scale, node)
}

function section(title, spec) {
  const el = document.createElement('section')
  el.className = 'promo-section'
  const h = document.createElement('h2')
  h.textContent = title
  const p = document.createElement('p')
  p.className = 'promo-spec'
  p.textContent = spec
  const row = document.createElement('div')
  row.className = 'promo-row'
  el.append(h, p, row)
  return { el, row }
}

function markSlot(src, file, kind, caption) {
  const slot = document.createElement('figure')
  slot.className = 'promo-slot'
  const img = document.createElement('img')
  img.className = 'promo-mark promo-' + kind
  img.alt = caption
  img.src = src
  img.dataset.file = file
  const cap = document.createElement('figcaption')
  const label = document.createElement('span')
  label.textContent = caption
  cap.appendChild(label)
  slot.append(frame(img, jpgButton(), compareButton()), cap)
  return slot
}

// Store copy, answers, and requirements come from /release/data.js, shared with the Release Kit.
const release = window.RELEASE

function storeOf(id) {
  return release.stores.find((s) => s.id === id)
}

function copyText(text, button) {
  const done = () => {
    const previous = button.textContent
    button.textContent = 'Copied'
    setTimeout(() => { button.textContent = previous }, 1200)
  }
  navigator.clipboard.writeText(text).then(done, () => { button.textContent = 'Copy failed' })
}

function copyButton(get) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'promo-jpg'
  button.textContent = 'Copy'
  button.addEventListener('click', () => copyText(get(), button))
  return button
}

function storeHeader(store) {
  const head = document.createElement('header')
  head.className = 'dist-store'
  const h = document.createElement('h2')
  h.textContent = store.label
  const link = document.createElement('a')
  link.href = store.url
  link.target = '_blank'
  link.rel = 'noopener'
  link.textContent = store.console + ' ↗'
  head.append(h, link)
  return head
}

function textGroup(title) {
  const el = document.createElement('section')
  el.className = 'promo-section'
  const h = document.createElement('h3')
  h.className = 'dist-group'
  h.textContent = title
  const list = document.createElement('div')
  list.className = 'dist-fields'
  el.append(h, list)
  return { el, list }
}

function fieldCard(field) {
  const card = document.createElement('div')
  card.className = 'dist-field'
  const head = document.createElement('div')
  head.className = 'dist-field-head'
  const label = document.createElement('strong')
  label.textContent = field.label
  const meta = document.createElement('span')
  meta.className = 'dist-count'
  if (field.limit) {
    meta.textContent = field.value.length + ' / ' + field.limit
    meta.classList.toggle('is-over', field.value.length > field.limit)
  }
  head.append(label, meta, copyButton(() => field.value))
  const value = document.createElement(field.multiline ? 'pre' : 'p')
  value.className = 'dist-value'
  value.textContent = field.value
  card.append(head, value)
  if (field.note) {
    const note = document.createElement('p')
    note.className = 'dist-note'
    note.textContent = field.note
    card.appendChild(note)
  }
  return card
}

function answerCard(answer) {
  const card = document.createElement('div')
  card.className = 'dist-field'
  const head = document.createElement('div')
  head.className = 'dist-field-head'
  const label = document.createElement('strong')
  label.textContent = answer.title
  head.append(label, document.createElement('span'), copyButton(() => answer.answer))
  const value = document.createElement('p')
  value.className = 'dist-value'
  value.textContent = answer.answer
  card.append(head, value)
  answer.notes.forEach((text) => {
    const note = document.createElement('p')
    note.className = 'dist-note'
    note.textContent = text
    card.appendChild(note)
  })
  return card
}

function blockerCard(blocker) {
  const card = document.createElement('div')
  card.className = 'dist-field dist-blocker'
  const label = document.createElement('strong')
  label.textContent = blocker.title
  const body = document.createElement('p')
  body.className = 'dist-note'
  body.textContent = blocker.body
  const where = document.createElement('p')
  where.className = 'dist-where'
  where.textContent = blocker.where
  card.append(label, body, where)
  return card
}

// Text, answers, and open issues for one store, in the order the console asks for them.
function storeText(storeId) {
  const sections = []
  const fields = release.fields.filter((f) => f.store === storeId)
  const groups = [...new Set(fields.map((f) => f.group))]
  groups.forEach((group) => {
    const g = textGroup(group)
    fields.filter((f) => f.group === group).forEach((f) => g.list.appendChild(fieldCard(f)))
    sections.push({ id: fileSlug(group), label: group, el: g.el })
  })
  if (storeId === 'apple') {
    const purpose = textGroup('Info.plist purpose strings')
    release.purposeStrings.forEach((p) => purpose.list.appendChild(fieldCard({ label: p.key, value: p.value, note: p.note })))
    sections.push({ id: 'purpose', label: 'Purpose strings', el: purpose.el })
  }
  const answers = release.answers.filter((a) => a.store === storeId)
  if (answers.length) {
    const g = textGroup('Questionnaires and declarations')
    answers.forEach((a) => g.list.appendChild(answerCard(a)))
    sections.push({ id: 'answers', label: 'Questionnaires', el: g.el })
  }
  const blockers = release.blockers.filter((b) => b.store === storeId)
  if (blockers.length) {
    const g = textGroup('Fix in the app before submitting')
    blockers.forEach((b) => g.list.appendChild(blockerCard(b)))
    sections.push({ id: 'blockers', label: 'Before submitting', el: g.el })
  }
  const checklist = release.checklist.filter((c) => c.store === storeId || c.store === 'all')
  if (checklist.length) {
    const g = textGroup('Checklist')
    const list = document.createElement('ul')
    list.className = 'dist-checklist'
    checklist.forEach((c) => c.items.forEach((item) => {
      const li = document.createElement('li')
      li.textContent = item
      list.appendChild(li)
    }))
    const track = document.createElement('a')
    track.href = '/release/#checklist'
    track.textContent = 'Track progress in the Release Kit ↗'
    g.list.append(list, track)
    sections.push({ id: 'checklist', label: 'Checklist', el: g.el })
  }
  return sections
}

// Plain files (icons) that ship as-is rather than rendered from a board.
function assetSlot(src, file, caption, size) {
  const slot = document.createElement('figure')
  slot.className = 'promo-slot'
  const img = document.createElement('img')
  img.className = 'dist-icon'
  img.src = src
  img.alt = caption
  img.width = size
  img.height = size
  const cap = document.createElement('figcaption')
  const label = document.createElement('span')
  label.textContent = caption
  const link = document.createElement('a')
  link.className = 'promo-jpg-save'
  link.href = src
  link.download = file
  link.dataset.asset = file
  link.textContent = 'PNG'
  cap.appendChild(label)
  slot.append(frame(img, link), cap)
  return slot
}

// Markdown copy of every store field, added to the zip so the text travels with the images.
function storeMarkdown() {
  const lines = ['# satsigner store text', '', 'Generated from release/data.js.', '']
  release.stores.forEach((store) => {
    lines.push('## ' + store.label + ' (' + store.console + ')', '')
    release.fields.filter((f) => f.store === store.id).forEach((f) => {
      lines.push('### ' + f.group + ' · ' + f.label + (f.limit ? ' (' + f.value.length + '/' + f.limit + ')' : ''), '', f.value, '')
    })
    release.answers.filter((a) => a.store === store.id).forEach((a) => {
      lines.push('### ' + a.title, '', a.answer, '', ...a.notes.map((n) => '> ' + n), '')
    })
  })
  return lines.join('\n')
}

if (distributionView && !document.documentElement.classList.contains('is-embed')) {
  const og = section(
    'Open Graph',
    '1200 × 630. This is the image Facebook, LinkedIn, Slack, and X use for summary_large_image. Keep the wordmark and headline inside a 60px inset so crops still read.'
  )
  og.row.appendChild(wideBoard(
    'promo-og',
    0.58,
    'SATSIGNER',
    'See every sat.\nControl every key.',
    'Mobile self-custody that’s clear, private, and yours.',
    'account',
    1200,
    630,
    true,
    'open-graph'
  ))

  const chips = section(
    'Logos and chicklets',
    'The circular mark is the logo. The Zapstore and TestFlight buttons are the chicklets — use the files as shipped, at 40px tall or larger.'
  )
  chips.row.append(
    markSlot('/imgs/satSigner_symbol.png', 'logo-symbol', 'logo', 'Logo'),
    markSlot('/imgs/get-it-on-zapstore.svg', 'chicklet-zapstore', 'chicklet', 'Zapstore chicklet'),
    markSlot('/imgs/get-it-on-testflight.svg', 'chicklet-testflight', 'chicklet', 'TestFlight chicklet')
  )

  const posts = [
    {
      slug: 'see-every-sat',
      title: 'See every sat.\nControl every key.',
      sub: 'Mobile self-custody that’s clear, private, and yours.',
      screen: 'account'
    },
    {
      slug: 'sign-off-line',
      title: 'Sign off-line.',
      sub: 'Animated QR for an air-gapped signer.',
      screen: 'psbt-qr'
    }
  ]
  const formats = [
    { id: 'square', label: 'Square · Instagram, Facebook, LinkedIn, Nostr', w: 1080, h: 1080, scale: 0.3 },
    { id: 'portrait', label: 'Portrait · Instagram, LinkedIn, Facebook', w: 1080, h: 1350, scale: 0.24 },
    { id: 'story', label: 'Story · Stories, Reels, TikTok, Shorts', w: 1080, h: 1920, scale: 0.168 },
    { id: 'landscape', label: 'Landscape · X, LinkedIn', w: 1600, h: 900, scale: 0.36 }
  ]
  const social = section(
    'Social posts',
    'Two posts, each in the frame those networks accept. Square is the feed image. Portrait is the 4:5 feed. Story is 9:16, with the top and bottom 250px left clear of the network’s own controls. Landscape is the wide image post. Type stays inside the inset so a crop still reads.'
  )
  posts.forEach((post) => {
    formats.forEach((format) => {
      social.row.appendChild(wideBoard(
        'promo-social promo-social-' + format.id,
        format.scale,
        'SATSIGNER',
        post.title,
        post.sub,
        post.screen,
        format.w,
        format.h,
        true,
        'social-' + post.slug + '-' + format.id,
        format.label
      ))
    })
  })
  formats.forEach((format) => {
    social.row.appendChild(sphereBoard(
      'promo-social promo-social-' + format.id + ' promo-orb',
      format.scale,
      format.w,
      format.h,
      'social-orb-' + format.id,
      'Sphere · ' + format.label
    ))
  })

  const apple = section(
    'App Store screenshots',
    '1320 × 2868 portrait, the required 6.9-inch iPhone size. Upload up to 10. The first three show on the product page before the visitor scrolls, so each one stands alone. No prices, ratings, or “Download” calls.'
  )
  shots.forEach((shot) => apple.row.appendChild(shotBoard('promo-shot promo-apple', 0.082, shot, 1320, 2868, 'app-store-' + fileSlug(shot.title))))

  const feature = section(
    'Play feature graphic',
    '1024 × 500, JPEG or 24-bit PNG with no transparency. Required on the store listing. No Play logo and no ranking claims.'
  )
  feature.row.appendChild(wideBoard(
    'promo-feature',
    0.48,
    'SATSIGNER',
    'See every sat.',
    'Your keys. Every coin. One signer.',
    'coins',
    1024,
    500,
    true,
    'play-feature'
  ))

  const play = section(
    'Play phone screenshots',
    '1080 × 1920, a 9:16 frame inside Google’s rules: each side from 320 to 3840 pixels, and the long side at most twice the short side. JPEG or 24-bit PNG, no alpha. Two to eight images.'
  )
  shots.forEach((shot) => play.row.appendChild(shotBoard('promo-shot promo-play', 0.1, shot, 1080, 1920, 'play-' + fileSlug(shot.title))))

  const download = document.createElement('button')
  download.type = 'button'
  download.className = 'promo-download'
  download.textContent = 'Download all images'
  const status = document.createElement('p')
  status.className = 'promo-spec'
  download.addEventListener('click', () => exportDistribution(download, status))
  const appleIcon = section(
    'App Store icon',
    '1024 × 1024 PNG, square, no transparency or rounded corners. It ships inside the build (Images.xcassets), so App Store Connect has no upload field for it. This is the file the current build uses.'
  )
  appleIcon.row.appendChild(assetSlot('/imgs/store/app-icon-1024.png', 'app-store-icon-1024.png', 'App Store icon', 160))

  const playIcon = section(
    'Play app icon',
    '512 × 512, 32-bit PNG, up to 1 MB. Upload a full square; Play rounds the corners and adds the shadow itself.'
  )
  playIcon.row.appendChild(assetSlot('/imgs/store/play-icon-512.png', 'play-icon-512.png', 'Play icon', 160))

  const shared = { label: 'Shared', console: 'Website, social, and Zapstore', url: '/' }
  const stores = [
    {
      store: storeOf('apple'),
      sections: [
        { id: 'screenshots', label: 'Screenshots', el: apple.el },
        { id: 'icon', label: 'Icon', el: appleIcon.el },
        ...storeText('apple')
      ]
    },
    {
      store: storeOf('testflight'),
      sections: storeText('testflight')
    },
    {
      store: storeOf('play'),
      sections: [
        { id: 'screenshots', label: 'Screenshots', el: play.el },
        { id: 'feature', label: 'Feature graphic', el: feature.el },
        { id: 'icon', label: 'Icon', el: playIcon.el },
        ...storeText('play')
      ]
    },
    {
      store: shared,
      sections: [
        { id: 'open-graph', label: 'Open Graph', el: og.el },
        { id: 'social', label: 'Social posts', el: social.el },
        { id: 'chicklets', label: 'Logos and chicklets', el: chips.el }
      ]
    }
  ]

  function tabBar(className, items, onPick) {
    const bar = document.createElement('div')
    bar.className = 'dist-tabs ' + className
    bar.setAttribute('role', 'tablist')
    items.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'dist-tab'
      button.setAttribute('role', 'tab')
      button.dataset.id = item.id
      button.textContent = item.label
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false')
      button.addEventListener('click', () => onPick(item.id))
      bar.appendChild(button)
    })
    return bar
  }

  function selectTab(bar, id) {
    bar.querySelectorAll('.dist-tab').forEach((button) => {
      button.setAttribute('aria-selected', button.dataset.id === id ? 'true' : 'false')
    })
  }

  const storeBar = tabBar('dist-store-tabs', stores.map((entry) => ({ id: entry.store.id || 'shared', label: entry.store.label })), showStore)
  const tabActions = document.createElement('div')
  tabActions.className = 'dist-tab-actions'
  tabActions.append(status, download)
  storeBar.appendChild(tabActions)
  const panels = []
  stores.forEach((entry, index) => {
    const id = entry.store.id || 'shared'
    const panel = document.createElement('div')
    panel.className = 'dist-panel'
    panel.dataset.store = id
    panel.hidden = index !== 0
    const head = storeHeader(entry.store)
    const sectionBar = tabBar('dist-section-tabs', entry.sections, (sectionId) => showSection(id, sectionId))
    entry.sections.forEach((section, sectionIndex) => {
      section.el.dataset.section = section.id
      section.el.hidden = sectionIndex !== 0
      panel.appendChild(section.el)
    })
    panel.prepend(head, sectionBar)
    panels.push(panel)
  })

  function selectedSection(storeId) {
    const panel = panels.find((item) => item.dataset.store === storeId)
    const current = panel && panel.querySelector('.dist-section-tabs [aria-selected="true"]')
    return current ? current.dataset.id : ''
  }

  function writeSelection(storeId, sectionId) {
    const url = new URL(location.href)
    url.searchParams.set('store', storeId)
    if (sectionId) url.searchParams.set('section', sectionId)
    else url.searchParams.delete('section')
    history.replaceState(null, '', url)
  }

  function showStore(id, write) {
    selectTab(storeBar, id)
    panels.forEach((panel) => { panel.hidden = panel.dataset.store !== id })
    paintDistributionGlow()
    if (write !== false) writeSelection(id, selectedSection(id))
  }

  function showSection(storeId, sectionId, write) {
    const panel = panels.find((item) => item.dataset.store === storeId)
    if (!panel) return
    const known = panel.querySelector('.dist-section-tabs [data-id="' + sectionId + '"]')
    if (!known) return
    selectTab(panel.querySelector('.dist-section-tabs'), sectionId)
    panel.querySelectorAll('[data-section]').forEach((section) => {
      section.hidden = section.dataset.section !== sectionId
    })
    paintDistributionGlow()
    if (write !== false) writeSelection(storeId, sectionId)
  }

  distributionView.append(storeBar, ...panels)
  const params = new URLSearchParams(location.search)
  const shot = params.get('shot')
  if (shot) {
    const node = distributionView.querySelector('[data-file="' + shot + '"]')
    const panel = node && node.closest('.dist-panel')
    const block = node && node.closest('[data-section]')
    if (panel) showStore(panel.dataset.store)
    if (panel && block) showSection(panel.dataset.store, block.dataset.section)
    setTimeout(() => showCheck(shot), 0)
  } else {
    const storeId = params.get('store')
    const hasStore = storeId && panels.some((panel) => panel.dataset.store === storeId)
    if (hasStore) {
      showStore(storeId, false)
      const sectionId = params.get('section')
      if (sectionId) showSection(storeId, sectionId, false)
    }
  }
}

// One still frame of the homepage hero rim light. Same shader, time frozen.
const glowFs = [
  'precision highp float;',
  'uniform vec2 uRes;',
  'uniform vec2 uCenter;',
  'uniform float uTime;',
  'uniform float uDpr;',
  'uniform vec2 uHalf;',
  'uniform float uRadius;',
  'uniform float uFade;',
  'float hash21(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
  'float sdRoundBox(vec2 p, vec2 b, float r){',
  '  vec2 q = abs(p) - b + r;',
  '  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;',
  '}',
  'void main(){',
  '  vec2 p = gl_FragCoord.xy;',
  '  p.y = uRes.y - p.y;',
  '  vec2 d = p - uCenter;',
  '  vec2 b = uHalf;',
  '  float rad = min(uRadius, min(b.x, b.y));',
  '  float sdf = sdRoundBox(d, b, rad);',
  '  vec2 q = abs(d) - b + rad;',
  '  vec2 g = max(q, 0.0);',
  '  float lg = length(g);',
  '  vec2 n = sign(d) * (lg > 0.001 ? g / lg : normalize(vec2(q.x, q.y) + vec2(0.0001)));',
  '  vec2 key = vec2(cos(uTime), sin(uTime));',
  '  float face = smoothstep(-0.15, 0.9, dot(n, key));',
  '  float far = exp(-max(sdf, 0.0) / (100.0 * uDpr));',
  '  float down = clamp((p.y - (uCenter.y - uHalf.y)) / (uHalf.y * 2.0), 0.0, 1.0);',
  '  float light = far * (0.36 + 0.18 * face) * mix(0.42, 1.0, down) * uFade;',
  '  vec2 css = p / max(uDpr, 1.0);',
  '  float grain = hash21(floor(css * 2.17));',
  '  grain += hash21(floor(css * 5.71 + vec2(19.0, 7.0)));',
  '  grain += hash21(floor(css * 11.3 + vec2(3.0, 41.0)));',
  '  grain += hash21(floor(css * 23.9 + vec2(8.0, 2.0)));',
  '  grain *= 0.25;',
  '  float floorDark = mix(0.034, 0.026, grain);',
  '  float glow = light * mix(0.92, 1.06, grain);',
  '  float col = floorDark + glow;',
  '  float rim = smoothstep(-0.2 * uDpr, 1.15 * uDpr, sdf);',
  '  col = mix(floorDark, col, rim);',
  '  gl_FragColor = vec4(vec3(col), 1.0);',
  '}'
].join('\n')

function paintGlow(board) {
  if (board.querySelector('canvas.promo-glow')) return
  const phone = board.querySelector('.promo-phone')
  if (!phone || !phone.offsetWidth) return
  const canvas = document.createElement('canvas')
  canvas.className = 'promo-glow'
  const w = Number(board.dataset.w)
  const h = Number(board.dataset.h)
  canvas.width = w
  canvas.height = h
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true })
  if (!gl) return
  const vs = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'
  function compile(type, src) {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    return sh
  }
  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs))
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, glowFs))
  gl.linkProgram(prog)
  gl.useProgram(prog)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'a')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const radius = phone.offsetWidth * 48 / 280
  phone.style.borderRadius = radius + 'px'
  const halfX = Math.max(1, phone.offsetWidth / 2)
  const halfY = Math.max(1, phone.offsetHeight / 2)
  gl.viewport(0, 0, w, h)
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), w, h)
  gl.uniform2f(gl.getUniformLocation(prog, 'uCenter'), phone.offsetLeft + phone.offsetWidth / 2, phone.offsetTop + phone.offsetHeight / 2)
  gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), Math.PI / 2)
  gl.uniform1f(gl.getUniformLocation(prog, 'uDpr'), 1)
  gl.uniform2f(gl.getUniformLocation(prog, 'uHalf'), halfX, halfY)
  gl.uniform1f(gl.getUniformLocation(prog, 'uRadius'), radius)
  gl.uniform1f(gl.getUniformLocation(prog, 'uFade'), 0.7)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  board.insertBefore(canvas, board.firstChild)
}

let checkRestore = null

function closeCheck() {
  if (!checkRestore) return
  checkRestore()
  checkRestore = null
}

async function showCheck(target) {
  closeCheck()
  const slot = typeof target === 'string'
    ? distributionView.querySelector('[data-file="' + target + '"]')?.closest('.promo-slot')
    : target
  if (!slot) return
  const board = slot.querySelector('.promo-board')
  const mark = slot.querySelector('.promo-mark')
  const asset = board || mark
  if (!asset) return
  const w = board ? Number(board.dataset.w) : mark.getBoundingClientRect().width
  const h = board ? Number(board.dataset.h) : mark.getBoundingClientRect().height
  const fit = Math.min(board ? 0.42 : 1, (window.innerHeight - 72) / h, (window.innerWidth - 48) / (w * 2 + 24))
  const stage = document.createElement('div')
  stage.className = 'promo-check'
  const column = (title) => {
    const col = document.createElement('figure')
    col.className = 'promo-check-col'
    const cap = document.createElement('figcaption')
    cap.textContent = title
    const frame = document.createElement('div')
    frame.className = 'promo-check-frame'
    frame.style.width = Math.max(1, w * fit) + 'px'
    frame.style.height = Math.max(1, h * fit) + 'px'
    col.append(cap, frame)
    return { col, frame }
  }
  const html = column('HTML')
  const jpeg = column('JPEG')
  const jpegLabel = jpeg.col.querySelector('figcaption')
  const remake = document.createElement('button')
  remake.type = 'button'
  remake.className = 'promo-jpg'
  remake.textContent = 'Remake JPEG'
  jpegLabel.textContent = ''
  const jpegName = document.createElement('span')
  jpegName.textContent = 'JPEG'
  jpegLabel.append(jpegName, remake)
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'promo-jpg promo-check-close'
  close.textContent = 'Close'
  close.addEventListener('click', closeCheck)
  const img = document.createElement('img')
  img.alt = 'JPEG of ' + (asset.dataset.file || '')
  img.style.width = '100%'
  img.style.height = '100%'
  jpeg.frame.appendChild(img)
  if (board) {
    const scaleWrap = board.parentElement
    const caption = slot.querySelector('figcaption')
    const previous = {
      transform: board.style.transform,
      width: scaleWrap.style.width,
      height: scaleWrap.style.height,
      wrapTransform: scaleWrap.style.transform,
      origin: scaleWrap.style.transformOrigin
    }
    board.style.transform = 'none'
    scaleWrap.style.width = w + 'px'
    scaleWrap.style.height = h + 'px'
    scaleWrap.style.transform = 'scale(' + fit + ')'
    scaleWrap.style.transformOrigin = 'top left'
    html.frame.appendChild(scaleWrap)
    checkRestore = () => {
      board.style.transform = previous.transform
      scaleWrap.style.width = previous.width
      scaleWrap.style.height = previous.height
      scaleWrap.style.transform = previous.wrapTransform
      scaleWrap.style.transformOrigin = previous.origin
      slot.insertBefore(scaleWrap, caption)
      stage.remove()
      document.removeEventListener('keydown', onKey)
    }
  } else {
    const preview = document.createElement('img')
    preview.alt = mark.alt
    preview.src = mark.src
    preview.style.width = '100%'
    preview.style.height = '100%'
    preview.style.objectFit = 'contain'
    html.frame.appendChild(preview)
    html.frame.style.background = 'transparent'
    checkRestore = () => {
      stage.remove()
      document.removeEventListener('keydown', onKey)
    }
  }
  stage.append(html.col, jpeg.col, close)
  stage.addEventListener('click', (event) => {
    if (event.target === stage) closeCheck()
  })
  function onKey(event) {
    if (event.key === 'Escape') closeCheck()
  }
  document.addEventListener('keydown', onKey)
  document.body.appendChild(stage)
  const renderJpeg = async () => {
    if (remake.disabled) return
    remake.disabled = true
    jpegName.textContent = 'JPEG — rendering'
    delete jpeg.col.dataset.ready
    try {
      let canvas
      if (board) {
        if (!board.querySelector('canvas.promo-glow')) paintGlow(board)
        canvas = await boardCanvas(board, 1)
      } else {
        const shot = await markCanvas(mark, 1)
        canvas = flatten(shot.canvas, '#000')
      }
      img.src = canvas.toDataURL('image/jpeg', 0.92)
      jpegName.textContent = 'JPEG'
      jpeg.col.dataset.ready = '1'
    } catch (err) {
      jpegName.textContent = err && err.message ? err.message : 'JPEG failed'
    } finally {
      remake.disabled = false
    }
  }
  remake.addEventListener('click', renderJpeg)
  renderJpeg()
}

function reveal(node) {
  const opened = []
  let current = node
  while (current && current !== distributionView) {
    if (current.hidden) {
      current.hidden = false
      opened.push(current)
    }
    current = current.parentElement
  }
  return () => opened.forEach((el) => { el.hidden = true })
}

function paintDistributionGlow() {
  if (!distributionView || distributionView.hidden) return
  distributionView.querySelectorAll('.promo-board').forEach((board) => {
    try { paintGlow(board) } catch (err) { /* a glow failure must not drop the open tab */ }
  })
}

paintDistributionGlow()
if (distributionView) {
  new MutationObserver(paintDistributionGlow).observe(distributionView, { attributes: true, attributeFilter: ['hidden'] })
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const XHTML_NS = 'http://www.w3.org/1999/xhtml'

function bytesToBase64(bytes) {
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

async function blobToDataUrl(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  return 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + bytesToBase64(buf)
}

function textLines(node) {
  const text = node.textContent
  const lines = []
  let start = 0
  while (start < text.length) {
    while (start < text.length && text[start] === '\n') start += 1
    if (start >= text.length) break
    let end = start + 1
    const range = node.ownerDocument.createRange()
    range.setStart(node, start)
    range.setEnd(node, Math.min(end, text.length))
    const first = range.getClientRects()[0]
    if (!first) break
    const top = first.top
    while (end < text.length) {
      range.setEnd(node, end + 1)
      const rects = range.getClientRects()
      const last = rects[rects.length - 1]
      if (!last || last.top > top + 1) break
      end += 1
    }
    range.setStart(node, start)
    range.setEnd(node, end)
    const rect = range.getBoundingClientRect()
    lines.push({ text: text.slice(start, end).replace(/\s+/g, ' '), rect })
    start = end
  }
  return lines
}

function visualScale(el, root) {
  let scale = 1
  let node = el
  const win = el.ownerDocument.defaultView
  while (node && node !== root.parentElement) {
    const transform = win.getComputedStyle(node).transform
    if (transform && transform !== 'none') {
      const matrix = new DOMMatrix(transform)
      scale *= matrix.a || 1
    }
    node = node.parentElement
  }
  return scale || 1
}

function chainOpacity(el, root) {
  let alpha = 1
  let node = el
  const win = el.ownerDocument.defaultView
  while (node && node !== root.parentElement) {
    const opacity = parseFloat(win.getComputedStyle(node).opacity)
    if (opacity < 1) alpha *= opacity
    node = node.parentElement
  }
  return alpha
}

function colorWithAlpha(color, alpha) {
  const match = String(color).match(/rgba?\(([^)]+)\)/)
  if (!match || alpha >= 1) return color
  const parts = match[1].split(',').map((part) => part.trim())
  const base = parts.length > 3 ? parseFloat(parts[3]) : 1
  return 'rgba(' + parts[0] + ', ' + parts[1] + ', ' + parts[2] + ', ' + (base * alpha) + ')'
}

function shapedText(text, transform) {
  if (transform === 'uppercase') return text.toUpperCase()
  if (transform === 'lowercase') return text.toLowerCase()
  if (transform === 'capitalize') return text.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
  return text
}

function paintText(root, width, height, scale) {
  if (root.dataset.baked) return
  if (root.ownerDocument.fonts) root.ownerDocument.fonts.ready
  const doc = root.ownerDocument
  const canvas = doc.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  const base = root.getBoundingClientRect()
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  nodes.forEach((node) => {
    const parent = node.parentElement
    if (!parent || parent.closest('svg') || parent.closest('.promo-text-layer')) return
    if (!node.textContent.trim()) return
    const style = doc.defaultView.getComputedStyle(parent)
    const visual = visualScale(parent, root)
    const fontSize = parseFloat(style.fontSize) * visual
    ctx.font = style.fontStyle + ' ' + style.fontWeight + ' ' + fontSize + 'px ' + style.fontFamily
    ctx.fillStyle = colorWithAlpha(style.color, chainOpacity(parent, root))
    ctx.textBaseline = 'alphabetic'
    if ('fontKerning' in ctx) ctx.fontKerning = 'normal'
    if ('letterSpacing' in ctx) {
      const spacing = style.letterSpacing === 'normal' ? 0 : parseFloat(style.letterSpacing) * visual
      ctx.letterSpacing = spacing + 'px'
    }
    const fontBox = ctx.measureText('Hg')
    const ascent = fontBox.fontBoundingBoxAscent || fontBox.actualBoundingBoxAscent || 0
    const descent = fontBox.fontBoundingBoxDescent || fontBox.actualBoundingBoxDescent || 0
    textLines(node).forEach((line) => {
      const text = shapedText(line.text, style.textTransform)
      if (!text.trim() || !line.rect.width) return
      // One baseline for the font, so a tilde stays with the digits instead of sinking to mid-line.
      const leading = Math.max(0, line.rect.height - ascent - descent)
      const baseline = line.rect.top - base.top + leading / 2 + ascent
      ctx.fillText(text, line.rect.left - base.left, baseline)
    })
  })
  nodes.forEach((node) => {
    const parent = node.parentElement
    if (!parent || parent.closest('svg')) return
    parent.style.setProperty('-webkit-text-fill-color', 'transparent', 'important')
  })
  root.dataset.baked = '1'
  return canvas
}

function bakeSvgPaint(root) {
  const win = root.ownerDocument.defaultView
  root.querySelectorAll('svg *').forEach((el) => {
    if (el.closest('defs')) return
    const cs = win.getComputedStyle(el)
    const alpha = chainOpacity(el, root)
    ;['stroke', 'fill'].forEach((prop) => {
      const value = cs[prop]
      if (!value || value === 'none') return
      el.style.setProperty(prop, colorWithAlpha(value, alpha), 'important')
    })
  })
}

async function rasterIcons(root) {
  const win = root.ownerDocument.defaultView
  const svgs = [...root.querySelectorAll('svg')]
  await Promise.all(svgs.map(async (svg) => {
    // getBoundingClientRect includes --ui-scale. The bitmap has to match the
    // layout box, or the same transform enlarges it a second time.
    const cs = win.getComputedStyle(svg)
    let w = parseFloat(cs.width)
    let h = parseFloat(cs.height)
    if (!w || !h) {
      const iconBox = svg.getBoundingClientRect()
      const scale = visualScale(svg, root) || 1
      w = iconBox.width / scale
      h = iconBox.height / scale
    }
    if (!w || !h) return
    const copy = svg.cloneNode(true)
    copy.setAttribute('xmlns', SVG_NS)
    copy.setAttribute('width', String(w))
    copy.setAttribute('height', String(h))
    // Standalone SVG images resolve currentColor from the root color, not the page.
    copy.style.color = win.getComputedStyle(svg).color
    const view = copy.viewBox && copy.viewBox.baseVal
    const unit = view && view.width ? w / view.width : 1
    copy.querySelectorAll('path, line, circle, polyline, polygon, rect').forEach((shape) => {
      const width = parseFloat(shape.getAttribute('stroke-width') || '1')
      if (!width || width * unit >= 1.6) return
      shape.setAttribute('stroke-width', String(1.6 / unit))
    })
    const xml = new XMLSerializer().serializeToString(copy)
    let shot
    try {
      shot = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml))
    } catch (err) {
      return
    }
    const canvas = svg.ownerDocument.createElement('canvas')
    const dpr = 3
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    canvas.getContext('2d').drawImage(shot, 0, 0, canvas.width, canvas.height)
    const img = svg.ownerDocument.createElement('img')
    img.alt = ''
    img.src = canvas.toDataURL('image/png')
    // Stay in the icon's box. Parking the bitmap on the phone root paints it
    // under .phone-screen, which covers every icon inside the display.
    img.style.cssText = 'display:block;width:' + w + 'px!important;height:' + h + 'px!important;max-width:none;flex:none;'
    svg.replaceWith(img)
  }))
}

function bakeButtons(root) {
  const doc = root.ownerDocument
  const win = doc.defaultView
  root.querySelectorAll('button').forEach((el) => {
    const cs = win.getComputedStyle(el)
    const side = (edge) => cs['border' + edge + 'Width'] + ' ' + cs['border' + edge + 'Style'] + ' ' + cs['border' + edge + 'Color']
    el.style.setProperty('appearance', 'none', 'important')
    el.style.setProperty('-webkit-appearance', 'none', 'important')
    el.style.setProperty('background-color', cs.backgroundColor, 'important')
    el.style.setProperty('background-image', cs.backgroundImage, 'important')
    el.style.setProperty('border-top', side('Top'), 'important')
    el.style.setProperty('border-right', side('Right'), 'important')
    el.style.setProperty('border-bottom', side('Bottom'), 'important')
    el.style.setProperty('border-left', side('Left'), 'important')
    el.style.setProperty('border-radius', cs.borderRadius, 'important')
    el.style.setProperty('box-shadow', cs.boxShadow, 'important')
    el.style.setProperty('box-sizing', cs.boxSizing, 'important')
    el.style.setProperty('height', cs.height, 'important')
    el.style.setProperty('min-height', '0', 'important')
    el.style.setProperty('padding-top', cs.paddingTop, 'important')
    el.style.setProperty('padding-bottom', cs.paddingBottom, 'important')
    el.style.setProperty('line-height', cs.lineHeight, 'important')
    const before = win.getComputedStyle(el, '::before')
    if (before.content === 'none' || !before.backgroundImage || before.backgroundImage === 'none') return
    const bar = doc.createElement('span')
    bar.setAttribute('aria-hidden', 'true')
    bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:' + before.height + ';background-image:' + before.backgroundImage + ';pointer-events:none;'
    el.prepend(bar)
  })
}

function bakeVertical(root) {
  const win = root.ownerDocument.defaultView
  ;[root, ...root.querySelectorAll('*')].forEach((el) => {
    if (el.closest('svg')) return
    const cs = win.getComputedStyle(el)
    if (cs.display === 'inline' || cs.display === 'contents' || cs.position === 'absolute' || cs.position === 'fixed') return
    if (!cs.height || cs.height === 'auto') return
    el.style.setProperty('box-sizing', cs.boxSizing, 'important')
    el.style.setProperty('height', cs.height, 'important')
    el.style.setProperty('margin-top', cs.marginTop, 'important')
    el.style.setProperty('margin-bottom', cs.marginBottom, 'important')
    el.style.setProperty('padding-top', cs.paddingTop, 'important')
    el.style.setProperty('padding-bottom', cs.paddingBottom, 'important')
  })
}

function rasterCss(css) {
  return css
    .replace(/:root\b/g, '.raster-root')
    .replace(/Inter/g, 'sans-serif')
    .replace(/(?:-webkit-)?mask(?:-image|-size|-repeat|-position|-mode|-origin|-clip)?\s*:[^;]*;/g, '')
    .replace(/backdrop-filter\s*:[^;]*;/g, 'backdrop-filter:none;')
    .replace(/(^|[^-])filter\s*:[^;]*;/g, '$1filter:none;')
}

function sheetCss(doc) {
  let css = ''
  for (const sheet of [...doc.styleSheets]) {
    let rules = ''
    try {
      for (const rule of sheet.cssRules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) continue
        rules += rule.cssText + '\n'
      }
    } catch (err) {
      continue
    }
    const base = sheet.href || doc.baseURI
    rules = rules.replace(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g, (match, quote, raw) => {
      try {
        return 'url("' + new URL(raw.trim(), base).href + '")'
      } catch (err) {
        return match
      }
    })
    css += rules
  }
  return css
}

const cssDataUrls = new Map()
async function embedCssUrls(css) {
  const urls = [...css.matchAll(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g)].map((match) => match[2])
  await Promise.all([...new Set(urls)].map(async (url) => {
    if (cssDataUrls.has(url)) return
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(String(res.status))
      cssDataUrls.set(url, await blobToDataUrl(await res.blob()))
    } catch (err) {
      cssDataUrls.set(url, '')
    }
  }))
  return css.replace(/url\(\s*(['"]?)(?!data:)([^'")]+)\1\s*\)/g, (match, quote, url) => {
    const data = cssDataUrls.get(url)
    return data ? 'url("' + data + '")' : 'none'
  })
}

async function inlineImages(root) {
  const images = [...root.querySelectorAll('img')]
  await Promise.all(images.map(async (img) => {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:')) return
    const res = await fetch(new URL(src, location.href))
    img.setAttribute('src', await blobToDataUrl(await res.blob()))
  }))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not rasterize artwork'))
    img.src = src
  })
}

async function rasterNode(node, width, height, scale, css) {
  await inlineImages(node)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('xmlns', SVG_NS)
  svg.setAttribute('width', String(width * scale))
  svg.setAttribute('height', String(height * scale))
  svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height)
  const fo = document.createElementNS(SVG_NS, 'foreignObject')
  fo.setAttribute('width', String(width))
  fo.setAttribute('height', String(height))
  const host = document.createElementNS(XHTML_NS, 'div')
  host.setAttribute('xmlns', XHTML_NS)
  host.setAttribute('class', 'raster-root')
  host.style.cssText = 'width:' + width + 'px;height:' + height + 'px;overflow:hidden;margin:0;'
  const style = document.createElementNS(XHTML_NS, 'style')
  style.textContent = css
  host.append(style, node)
  fo.appendChild(host)
  svg.appendChild(fo)
  const xml = new XMLSerializer().serializeToString(svg)
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

function paintGlare(canvas, frame, scale) {
  const blur = 1.8 * scale
  const border = Math.max(1, (frame * 4 / 280) * scale)
  const radius = (frame * 48 / 280) * scale
  const glow = (frame * 78 / 280) * scale
  const w = canvas.width
  const h = canvas.height
  const layer = document.createElement('canvas')
  layer.width = w
  layer.height = h
  const g = layer.getContext('2d')
  ;[[0, 0, 0.46], [w, 0, 0.46], [0, h, 0.36], [w, h, 0.36]].forEach(([x, y, alpha]) => {
    const rad = g.createRadialGradient(x, y, 0, x, y, glow)
    rad.addColorStop(0, 'rgba(255,255,255,' + alpha + ')')
    rad.addColorStop(0.38, 'rgba(255,255,255,' + (alpha * 0.35) + ')')
    rad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = rad
    g.fillRect(0, 0, w, h)
  })
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = '#fff'
  g.beginPath()
  g.roundRect(0, 0, w, h, radius)
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  g.beginPath()
  g.roundRect(border, border, w - border * 2, h - border * 2, Math.max(0, radius - border))
  g.fill()
  const ctx = canvas.getContext('2d')
  ctx.save()
  ctx.filter = 'blur(' + blur + 'px)'
  ctx.drawImage(layer, 0, 0)
  ctx.restore()
}

async function phoneShot(iframe, scale) {
  // Boards below the fold have lazy iframes that never load unless scrolled to.
  if (iframe.loading === 'lazy') iframe.loading = 'eager'
  const ready = () => iframe.contentDocument && iframe.contentDocument.querySelector('.phone')
  if (!ready()) {
    await new Promise((resolve, reject) => {
      const poll = setInterval(() => {
        if (!ready()) return
        clearInterval(poll)
        clearTimeout(timer)
        resolve()
      }, 200)
      const timer = setTimeout(() => {
        clearInterval(poll)
        reject(new Error('A phone preview is still loading'))
      }, 60000)
      iframe.addEventListener('load', () => {
        if (!ready()) return
        clearInterval(poll)
        clearTimeout(timer)
        resolve()
      }, { once: true })
    })
  }
  const doc = iframe.contentDocument
  if (!doc || !doc.body) throw new Error('A phone preview is still loading')
  if (doc.fonts) await doc.fonts.ready
  const phone = doc.querySelector('.phone')
  const width = phone.clientWidth
  const height = phone.clientHeight
  const host = doc.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;'
  const clone = phone.cloneNode(true)
  clone.style.setProperty('--frame', width + 'px', 'important')
  clone.style.setProperty('width', width + 'px', 'important')
  clone.style.setProperty('height', height + 'px', 'important')
  clone.style.setProperty('max-height', 'none', 'important')
  clone.style.setProperty('aspect-ratio', 'auto', 'important')
  host.appendChild(clone)
  doc.body.appendChild(host)
  bakeButtons(clone)
  bakeVertical(clone)
  const textLayer = paintText(clone, width, height, scale)
  bakeSvgPaint(clone)
  await rasterIcons(clone)
  host.remove()
  const liveCanvas = [...phone.querySelectorAll('canvas')]
  const clonedCanvas = [...clone.querySelectorAll('canvas')]
  liveCanvas.forEach((source, index) => {
    const target = clonedCanvas[index]
    if (!target) return
    try {
      const img = doc.createElement('img')
      img.alt = ''
      img.src = source.toDataURL('image/png')
      target.replaceWith(img)
    } catch (err) {
      target.remove()
    }
  })
  clone.style.width = width + 'px'
  clone.style.height = height + 'px'
  const css = rasterCss(await embedCssUrls(sheetCss(doc))) + '\n.phone{--frame:' + width + 'px!important;width:' + width + 'px!important;height:' + height + 'px!important;max-height:none!important;aspect-ratio:auto!important;}\n.phone::before{content:none!important;}\n.lb-act::before{content:none!important;}'
  const canvas = await rasterNode(clone, width, height, scale, css)
  paintGlare(canvas, width, scale)
  if (textLayer) canvas.getContext('2d').drawImage(textLayer, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

async function boardCanvas(board, scale) {
  const width = Number(board.dataset.w)
  const height = Number(board.dataset.h)
  const clone = board.cloneNode(true)
  clone.style.transform = 'none'
  const liveGlow = board.querySelector('canvas.promo-glow')
  const glow = clone.querySelector('canvas.promo-glow')
  if (liveGlow && glow) {
    const img = document.createElement('img')
    img.className = 'promo-glow'
    img.alt = ''
    img.src = liveGlow.toDataURL('image/png')
    glow.replaceWith(img)
  }
  const liveGrain = board.querySelector('canvas.promo-orb-grain')
  const grain = clone.querySelector('canvas.promo-orb-grain')
  if (liveGrain && grain) {
    const img = document.createElement('img')
    img.className = 'promo-orb-grain'
    img.alt = ''
    img.src = liveGrain.toDataURL('image/png')
    grain.replaceWith(img)
  }
  const liveFrames = [...board.querySelectorAll('iframe')]
  const frames = [...clone.querySelectorAll('iframe')]
  for (let i = 0; i < frames.length; i++) {
    const img = document.createElement('img')
    img.alt = ''
    img.style.cssText = 'display:block;width:100%;height:100%;'
    img.src = await phoneShot(liveFrames[i], scale)
    frames[i].replaceWith(img)
  }
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;pointer-events:none;'
  host.appendChild(clone)
  document.body.appendChild(host)
  const textLayer = paintText(clone, width, height, scale)
  host.remove()
  clone.querySelectorAll('.promo-text-layer').forEach((el) => el.remove())
  const css = rasterCss(await embedCssUrls(sheetCss(document)))
  const canvas = await rasterNode(clone, width, height, scale, css)
  if (textLayer) canvas.getContext('2d').drawImage(textLayer, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function markCanvas(img, scale) {
  if (!img.complete || !img.naturalWidth) {
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('A logo is still loading'))
    })
  }
  const height = img.classList.contains('promo-chicklet') ? 40 : 160
  const width = img.naturalWidth / img.naturalHeight * height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return { canvas, width, height }
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('Export produced an empty image'))
      else resolve(blob)
    }, type, quality)
  })
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function zipFiles(files) {
  const parts = []
  const central = []
  let offset = 0
  const encoder = new TextEncoder()
  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = file.data
    const compressed = await deflateRaw(data)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint16(6, 0x0800, true)
    view.setUint16(8, 8, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, compressed.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true)
    local.set(name, 30)
    parts.push(local, compressed)
    const cen = new Uint8Array(46 + name.length)
    const cenView = new DataView(cen.buffer)
    cenView.setUint32(0, 0x02014b50, true)
    cenView.setUint16(4, 20, true)
    cenView.setUint16(6, 20, true)
    cenView.setUint16(8, 0x0800, true)
    cenView.setUint16(10, 8, true)
    cenView.setUint32(16, crc, true)
    cenView.setUint32(20, compressed.length, true)
    cenView.setUint32(24, data.length, true)
    cenView.setUint16(28, name.length, true)
    cenView.setUint32(42, offset, true)
    cen.set(name, 46)
    central.push(cen)
    offset += local.length + compressed.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}

function scaledCopy(canvas, scale) {
  const copy = document.createElement('canvas')
  copy.width = Math.max(1, Math.round(canvas.width * scale))
  copy.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = copy.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, copy.width, copy.height)
  return copy
}

function flatten(canvas, color) {
  const copy = document.createElement('canvas')
  copy.width = canvas.width
  copy.height = canvas.height
  const ctx = copy.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, copy.width, copy.height)
  ctx.drawImage(canvas, 0, 0)
  return copy
}

async function exportJpg(button) {
  if (button.disabled) return
  const slot = button.closest('.promo-slot')
  const board = slot.querySelector('.promo-board')
  const mark = slot.querySelector('.promo-mark')
  const asset = board || mark
  button.disabled = true
  const previous = button.textContent
  button.textContent = '…'
  try {
    if (document.fonts) await document.fonts.ready
    let canvas
    if (board) {
      if (!board.querySelector('canvas.promo-glow')) paintGlow(board)
      canvas = await boardCanvas(board, 1)
    } else {
      const shot = await markCanvas(mark, 1)
      canvas = flatten(shot.canvas, '#000')
    }
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.92)
    let save = slot.querySelector('.promo-jpg-save')
    if (!save) {
      save = document.createElement('a')
      save.className = 'promo-jpg-save'
      button.after(save)
    }
    if (save.dataset.url) URL.revokeObjectURL(save.dataset.url)
    const url = URL.createObjectURL(blob)
    save.dataset.url = url
    save.href = url
    save.download = asset.dataset.file + '.jpg'
    save.textContent = 'Save'
    save.click()
  } catch (err) {
    button.textContent = err && err.message ? err.message : 'Failed'
    return
  } finally {
    button.disabled = false
    if (button.textContent === '…') button.textContent = previous
  }
}

async function exportDistribution(button, status) {
  if (button.disabled) return
  button.disabled = true
  const previous = button.textContent
  const files = []
  try {
    if (document.fonts) await document.fonts.ready
    const boards = [...distributionView.querySelectorAll('.promo-board')]
    const marks = [...distributionView.querySelectorAll('.promo-mark')]
    const total = boards.length + marks.length
    let done = 0
    for (const board of boards) {
      done += 1
      button.textContent = 'Rendering ' + done + ' / ' + total
      const hideAgain = reveal(board)
      if (!board.querySelector('canvas.promo-glow')) paintGlow(board)
      const width = Number(board.dataset.w)
      const height = Number(board.dataset.h)
      const canvas = await boardCanvas(board, 2)
      const png2x = await canvasBlob(canvas, 'image/png')
      const jpg2x = await canvasBlob(canvas, 'image/jpeg', 0.92)
      const one = scaledCopy(canvas, 0.5)
      const png = await canvasBlob(one, 'image/png')
      const jpg = await canvasBlob(one, 'image/jpeg', 0.92)
      const name = board.dataset.file
      files.push(
        { name: name + '.jpg', data: new Uint8Array(await jpg.arrayBuffer()) },
        { name: name + '@2x.jpg', data: new Uint8Array(await jpg2x.arrayBuffer()) },
        { name: name + '.png', data: new Uint8Array(await png.arrayBuffer()) },
        { name: name + '@2x.png', data: new Uint8Array(await png2x.arrayBuffer()) }
      )
      hideAgain()
    }
    for (const mark of marks) {
      done += 1
      button.textContent = 'Rendering ' + done + ' / ' + total
      const shot = await markCanvas(mark, 2)
      const flat2 = flatten(shot.canvas, '#000')
      const png2x = await canvasBlob(shot.canvas, 'image/png')
      const jpg2x = await canvasBlob(flat2, 'image/jpeg', 0.92)
      const one = scaledCopy(shot.canvas, 0.5)
      const flat1 = flatten(one, '#000')
      const png = await canvasBlob(one, 'image/png')
      const jpg = await canvasBlob(flat1, 'image/jpeg', 0.92)
      const name = mark.dataset.file
      files.push(
        { name: name + '.jpg', data: new Uint8Array(await jpg.arrayBuffer()) },
        { name: name + '@2x.jpg', data: new Uint8Array(await jpg2x.arrayBuffer()) },
        { name: name + '.png', data: new Uint8Array(await png.arrayBuffer()) },
        { name: name + '@2x.png', data: new Uint8Array(await png2x.arrayBuffer()) }
      )
    }
    for (const link of distributionView.querySelectorAll('a[data-asset]')) {
      const response = await fetch(link.href)
      files.push({ name: link.dataset.asset, data: new Uint8Array(await response.arrayBuffer()) })
    }
    files.push({ name: 'store-text.md', data: new TextEncoder().encode(storeMarkdown()) })
    button.textContent = 'Zipping…'
    const zip = await zipFiles(files)
    if (status.dataset.url) URL.revokeObjectURL(status.dataset.url)
    const url = URL.createObjectURL(zip)
    status.dataset.url = url
    const link = document.createElement('a')
    link.href = url
    link.download = 'satsigner-distribution.zip'
    link.textContent = 'Save satsigner-distribution.zip'
    status.replaceChildren(link)
    link.click()
  } catch (err) {
    status.textContent = err && err.message ? err.message : 'Export failed.'
  } finally {
    button.disabled = false
    button.textContent = previous
  }
}
