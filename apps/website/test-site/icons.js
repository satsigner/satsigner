/* SVG paths copied from apps/mobile/components/icons. Stroke/fill use currentColor. */

const icons = {
  bitcoin:
    '<svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10.5" stroke="currentColor" stroke-width="1.5"/></svg>',
  lightning:
    '<svg viewBox="0 0 16 20" fill="none"><path d="M9.80782 8.35964L10.0424 0L0 11.6933H6.04126L5.80933 20L15.7566 8.35964H9.80782Z" fill="currentColor"/></svg>',
  ark:
    '<svg viewBox="0 0 18 20" fill="none"><path d="M9 3.35 L16 17.2 Q9 15.35 2 17.2 Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.35"/></svg>',
  liquid:
    '<svg viewBox="0 0 10 18" fill="none"><path d="M5.19 0S10 10.046 10 12.558C10 15.07 9.265 18 5.147 18 1.03 18 0 15.07 0 12.558 0 10.047 5.19 0 5.19 0z" fill="none" stroke="currentColor"/></svg>',
  ecash:
    '<svg viewBox="0 0 16 18" fill="none"><path d="M5.70323 1.20333C7.41163 1.84838 8.30174 3.83486 7.69136 5.64026C7.43845 6.3883 7.56496 7.64599 8.3266 8.72629C9.00953 9.69495 9.98186 10.2147 11.2024 10.0111C12.9943 9.71209 14.6764 11.0049 14.9593 12.8986C15.2423 14.7923 14.019 16.5698 12.227 16.8688C8.24644 17.533 4.97583 15.5939 3.05839 12.8743C1.21966 10.2663 0.388367 6.60622 1.5047 3.30434C2.11508 1.49894 3.99483 0.558283 5.70323 1.20333Z" fill="none" stroke="currentColor"/></svg>',
  nostr:
    '<svg viewBox="0 0 9 9" fill="none"><path d="M6.6707 3.76083C6.6707 4.85083 5.5707 5.15083 4.2907 5.15083C2.6307 5.15083 1.8307 3.69083 0.220703 3.52083C0.450703 2.60083 2.1907 3.07083 3.2907 2.74083C5.5207 2.07083 6.6707 2.70083 6.6707 3.77083V3.76083Z" stroke="currentColor" stroke-width="0.6"/><path d="M1.65962 8.4707C1.40962 8.1207 1.44962 7.6807 1.44962 7.6807C1.72962 7.3207 2.26962 6.4507 2.40962 6.2707L4.20962 5.2207" stroke="currentColor" stroke-width="0.6"/><path d="M6.7209 3.55966C8.9009 2.85966 5.7809 0.829655 6.5909 0.289655C7.0509 -0.0203446 7.1509 0.639655 7.8409 0.669655" stroke="currentColor" stroke-width="0.6"/><path d="M6.71058 6.5207C6.55058 5.9307 5.94058 6.0707 5.94058 6.0707L3.97058 6.4107C3.92058 6.3607 4.21059 5.4907 4.32059 5.2207" stroke="currentColor" stroke-width="0.6"/></svg>',
  mempool:
    '<svg viewBox="0 0 22 15" fill="none"><path d="M8.44186 5.5C7.04651 6.16667 3.97674 9.6 1 14H21V5.5L16.3488 1C14.9535 3.83333 12.0698 9.2 11.6977 8C11.3256 6.8 9.37209 5.83333 8.44186 5.5Z" stroke="currentColor"/><path d="M1 14H21M3.5 10.5C4.43023 10.6795 9 8.5 11.6977 10.7692C12.2683 11.2492 14.9535 8.52564 16.3488 7L21 9.42308" stroke="currentColor"/></svg>',
  chaintip:
    '<svg viewBox="0 0 30 13" fill="none"><g opacity="0.24"><path d="M1.0002 5.0011H6.622V10.2481H1.0002V5.0011Z" stroke="currentColor"/><path d="M3.06133 2.75214H8.68313L6.6218 5.00086H1L3.06133 2.75214Z" stroke="currentColor"/><path d="M8.68323 7.99924V2.75223L6.6219 5.00095V10.248L8.68323 7.99924Z" stroke="currentColor"/></g><g opacity="0.35"><path d="M8.6748 4.78802H15.2784V10.9514H8.6748V4.78802Z" stroke="currentColor"/><path d="M11.0961 2.14624H17.6997L15.2784 4.78767H8.6748L11.0961 2.14624Z" stroke="currentColor"/><path d="M17.7 8.30957V2.14624L15.2787 4.78767V10.951L17.7 8.30957Z" stroke="currentColor"/></g><path d="M17.479 4.32974H25.8019V12.0978H17.479V4.32974Z" fill="var(--gray-830)" stroke="currentColor"/><path d="M20.5307 1H28.8537L25.8019 4.32918H17.479L20.5307 1Z" fill="var(--gray-830)" stroke="currentColor"/><path d="M28.8536 8.76808V1L25.8018 4.32918V12.0973L28.8536 8.76808Z" fill="var(--gray-830)" stroke="currentColor"/></svg>',
  block:
    '<svg viewBox="0 0 18 17" fill="none"><path d="M1.01221 5.38086H12.7106V16.2993H1.01221V5.38086Z" stroke="currentColor"/><path d="M5.3016 0.701172H17L12.7106 5.38051H1.01221L5.3016 0.701172Z" stroke="currentColor"/><path d="M16.9998 11.6196V0.701172L12.7104 5.38051V16.299L16.9998 11.6196Z" stroke="currentColor"/></svg>',
  transaction:
    '<svg viewBox="0 0 24 14" fill="none"><circle cx="2" cy="4" r="1.5" stroke="currentColor"/><path d="M3.5 4H14" stroke="currentColor"/><polygon points="14,1.5 18,4 14,6.5" fill="currentColor"/><path d="M18 10H8" stroke="currentColor"/><polygon points="8,7.5 4,10 8,12.5" fill="currentColor"/><circle cx="22" cy="10" r="1.5" stroke="currentColor"/></svg>',
  address:
    '<svg viewBox="0 0 18 16" fill="none"><g transform="translate(-0.77 -0.94)"><circle cx="4.77" cy="4.77" r="4.77" transform="translate(8.7 1.45)" fill="none" stroke="currentColor" stroke-width="0.75"/><circle cx="2.8" cy="2.8" r="2.8" transform="translate(1.27 4.51)" fill="none" stroke="currentColor" stroke-width="0.75"/><circle cx="2.28" cy="2.28" r="2.28" transform="translate(5.59 11.97)" fill="none" stroke="currentColor" stroke-width="0.75"/></g></svg>',
  difficulty:
    '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="8" stroke="currentColor"/><circle cx="9" cy="9" r="6" stroke="currentColor"/><circle cx="9" cy="9" r="4" stroke="currentColor"/><circle cx="9" cy="9" r="2" stroke="currentColor"/></svg>',
  halving:
    '<svg viewBox="0 0 18 18" fill="none"><circle cx="8" cy="9" r="7.4" stroke="currentColor"/><circle cx="8" cy="9" r="3.75" stroke="currentColor"/><path d="M17 9.1H9.7" stroke="currentColor"/></svg>',
  chain:
    '<svg viewBox="0 0 21 25" fill="none"><circle cx="15" cy="7.75" r="3.45" transform="rotate(25.4 15 7.75)" stroke="currentColor"/><rect x="4.23" y="13.63" width="8.96" height="2.7" rx="1.35" transform="rotate(-2.55 4.23 13.63)" stroke="currentColor"/><rect x="2.74" y="16.77" width="8.96" height="2.7" rx="1.35" transform="rotate(-2.55 2.74 16.77)" stroke="currentColor"/><rect x="5.75" y="10.43" width="8.96" height="2.7" rx="1.35" transform="rotate(-2.55 5.75 10.43)" stroke="currentColor"/><rect x="7.31" y="7.14" width="8.96" height="2.7" rx="1.35" transform="rotate(-2.55 7.31 7.14)" stroke="currentColor"/></svg>',
  node:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4.5"/><path d="M18.5 12H22M2 12h3.5M12 5.5V2M12 22v-3.5M16.6 7.4l2.47-2.47M4.93 19.07l2.47-2.47M7.4 7.4 4.93 4.93M19.07 19.07l-2.47-2.47"/></svg>',
  network:
    '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2" stroke="currentColor"/><path d="M9 1v4M9 13v4M1 9h4M13 9h4M3 3l3 3M12 12l3 3M15 3l-3 3M6 12l-3 3" stroke="currentColor"/></svg>',
  currency:
    '<svg viewBox="0 0 16 23" fill="none"><circle cx="8" cy="11" r="7.5" stroke="currentColor"/><path d="M6 16L9 19L6 22" stroke="currentColor"/><path d="M9 7L6 4L9 1" stroke="currentColor"/></svg>',
  time:
    '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor"/><path d="M8 4.5V8.5L11 8.5" stroke="currentColor"/></svg>',
  energy:
    '<svg viewBox="0 0 16 20" fill="none"><path d="M9.8 8.4L10 0L0 11.7h6L5.8 20L15.8 8.4H9.8Z" fill="currentColor"/></svg>',
  signer:
    '<svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10.5" stroke="currentColor"/></svg>',
  signerActive:
    '<svg viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="11" fill="currentColor"/></svg>',
  explorer:
    '<svg viewBox="0 0 28 16" fill="none"><mask id="explorer-outline" fill="#fff"><path fill-rule="evenodd" d="M14 12.228a7.724 7.724 0 1 1 0-9.008 7.724 7.724 0 1 1 0 9.008Z" clip-rule="evenodd"/></mask><path fill="currentColor" d="m14 12.228.812-.584-.812-1.13-.812 1.13.812.584Zm0-9.008-.812.584.812 1.13.812-1.13L14 3.22Zm-.812 8.424a6.714 6.714 0 0 1-5.464 2.804v2a8.714 8.714 0 0 0 7.088-3.636l-1.624-1.168Zm-5.464 2.804A6.724 6.724 0 0 1 1 7.724h-2a8.724 8.724 0 0 0 8.724 8.724v-2ZM1 7.724A6.724 6.724 0 0 1 7.724 1v-2A8.724 8.724 0 0 0-1 7.724h2ZM7.724 1a6.714 6.714 0 0 1 5.464 2.804l1.624-1.167A8.714 8.714 0 0 0 7.724-1v2Zm7.088 2.804A6.714 6.714 0 0 1 20.276 1v-2a8.714 8.714 0 0 0-7.088 3.637l1.624 1.167ZM20.276 1A6.724 6.724 0 0 1 27 7.724h2A8.724 8.724 0 0 0 20.276-1v2ZM27 7.724a6.724 6.724 0 0 1-6.724 6.724v2A8.724 8.724 0 0 0 29 7.724h-2Zm-6.724 6.724a6.714 6.714 0 0 1-5.464-2.804l-1.624 1.168a8.714 8.714 0 0 0 7.088 3.636v-2Z" mask="url(#explorer-outline)"/></svg>',
  explorerActive:
    '<svg viewBox="0 0 28 16" fill="none"><path fill="currentColor" fill-rule="evenodd" d="M14 12.228a7.724 7.724 0 1 1 0-9.008 7.724 7.724 0 1 1 0 9.008Z"/></svg>',
  converter:
    '<svg viewBox="0 0 16 23" fill="none"><circle cx="8" cy="11" r="7.5" stroke="currentColor"/><path d="M7 16L10 19L7 22" stroke="currentColor"/><path d="M9 7L6 4L9 1" stroke="currentColor"/></svg>',
  converterActive:
    '<svg viewBox="0 0 16 23" fill="none"><circle cx="8" cy="11" r="7" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/><path d="M9 15L12 18L9 21" stroke="currentColor"/><path d="M11 7L8 4L11 1" stroke="currentColor"/></svg>',
  chevron:
    '<svg viewBox="0 0 5 12" fill="none"><path d="M1 1l3 4.5L1 10" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  back:
    '<svg viewBox="0 0 12 12" fill="none"><path d="M8 1L3 6l5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  paste:
    '<svg viewBox="0 0 14 12" fill="none"><path d="M2.5 2.5h9a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" stroke="currentColor"/><path d="M4.5 2.5V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v.5M4 5h6M4 6.5h4M4 8h6" stroke="currentColor"/></svg>',
  camera:
    '<svg viewBox="0 0 14 12" fill="none"><path d="M13.5 3.8v7.9H.5V3.8h2.8a1.6 1.6 0 0 0 1.3-.7l.6-.9h3.9l.6.9a1.6 1.6 0 0 0 1.3.7Z" stroke="currentColor"/><circle cx="7" cy="7.2" r="2.5" stroke="currentColor"/></svg>',
  nfc:
    '<svg viewBox="0 0 14 16" fill="none"><path d="M8 2c3.4 3.4 3.4 9 0 12.4M5.5 4.5c2 2 2 5.4 0 7.4M3.3 6.7c.8.8.8 2.2 0 3" stroke="currentColor"/></svg>',
  incoming:
    '<svg viewBox="0 0 16 16" fill="none"><path d="M8.5.5V11m0 0L11 8.5M8.5 11 6 8.5" stroke="var(--main-green)"/><path d="M4 2a7.5 7.5 0 1 0 9 0" stroke="var(--main-green)"/></svg>',
  outgoing:
    '<svg viewBox="0 0 15 16" fill="none"><rect x="0.5" y="11" width="14" height="4" stroke="var(--main-red)"/><path d="M7.5 8.5V.5m0 0L5 3M7.5.5 10 3" stroke="var(--main-red)"/></svg>',
  refresh:
    '<svg viewBox="0 0 12 16" fill="none"><path d="M1 9.2A5.5 5.5 0 1 0 2.7 5.2" stroke="currentColor" stroke-width="0.75"/><path d="M7 7 2.4 5.1 4.2.5" stroke="currentColor" stroke-width="0.75"/></svg>',
  expand:
    '<svg viewBox="0 0 15 16" fill="none"><path d="M9 1h5.5v6M6 15H.5V9" stroke="currentColor"/></svg>',
  search:
    '<svg viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M12.2 12.2 16.5 16.5" stroke="currentColor" stroke-width="1.2"/></svg>',
  chart:
    '<svg viewBox="0 0 17 10" fill="none"><path d="M.6 9h3.9V2h4.6v4h1.8V.5h2v2.5h3.2" stroke="currentColor"/></svg>',
  menu:
    '<svg viewBox="0 0 13 10" fill="none"><path d="M4 1h8M4 5h8M4 9h8M2 1H0M2 5H0M2 9H0" stroke="currentColor"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" fill="none"><path stroke="currentColor" stroke-width="1" d="M9.594 3.94A1.125 1.125 0 0 1 10.7 3h2.6a1.125 1.125 0 0 1 1.11.94l.213 1.281a1.249 1.249 0 0 0 .645.87c.074.04.147.083.22.127a1.244 1.244 0 0 0 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.3 2.247a1.125 1.125 0 0 1-.26 1.431l-1 .827a1.239 1.239 0 0 0-.43.992q0 .127 0 .255a1.238 1.238 0 0 0 .43.991l1 .827a1.126 1.126 0 0 1 .26 1.43l-1.3 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456a1.246 1.246 0 0 0-1.076.124q-.109.066-.22.128a1.247 1.247 0 0 0-.644.869l-.213 1.281A1.124 1.124 0 0 1 13.3 21h-2.6a1.126 1.126 0 0 1-1.11-.94l-.214-1.281a1.245 1.245 0 0 0-.644-.87q-.111-.061-.22-.127a1.246 1.246 0 0 0-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.3-2.247a1.125 1.125 0 0 1 .26-1.431l1-.827a1.243 1.243 0 0 0 .43-.991q0-.127 0-.255a1.244 1.244 0 0 0-.43-.992l-1-.827a1.125 1.125 0 0 1-.26-1.43l1.3-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456a1.246 1.246 0 0 0 1.076-.124c.072-.044.146-.086.22-.128a1.241 1.241 0 0 0 .644-.869l.214-1.28Z"/><path stroke="currentColor" stroke-width="1" d="M15 12a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z"/></svg>',
  bubbles:
    '<svg viewBox="0 0 18 16" fill="none"><g transform="translate(-0.77 -0.94)"><circle cx="4.77" cy="4.77" r="4.77" transform="translate(8.7 1.45)" fill="none" stroke="currentColor" stroke-width="0.75"/><circle cx="2.8" cy="2.8" r="2.8" transform="translate(1.27 4.51)" fill="none" stroke="currentColor" stroke-width="0.75"/><circle cx="2.28" cy="2.28" r="2.28" transform="translate(5.59 11.97)" fill="none" stroke="currentColor" stroke-width="0.75"/></g></svg>'
}

function icon(name, className) {
  const markup = icons[name] || icons.bitcoin
  return markup.replace('<svg ', '<svg class="' + className + '" aria-hidden="true" ')
}
