# Studio protocol

Turn one SatSigner React Native screen into a static HTML, CSS, and JavaScript prototype. Source of truth is [satsigner/satsigner](https://github.com/satsigner/satsigner/) (`apps/mobile`). Studio is where flows and screens are designed and checked against the app. It does not change the marketing homepage.

## Files

- `tokens.css` — CSS variables copied from `apps/mobile/styles/colors.ts`, `sizes.ts`, and `layout.ts`. Glass borders come from `SSButton` elevated styles.
- `index.html` — studio page and phone frame.
- `screen.css` — layout for one screen. Uses variables from `tokens.css` only.
- `screen.js` — fixture data and light interaction.
- `icons.js` — SVG markup copied from `apps/mobile/components/icons`.

## Rules

1. Name the source screen in a comment at the top of `screen.js`. The first demo is `apps/mobile/app/(authenticated)/(tabs)/(signer,explorer,converter)/index.tsx`, plus `SSButton`, `SSText`, `SSMainLayout`, and `constants/navItems.ts`.
2. Map `View` to `div`, `Text` to `p` or `span`, and `Pressable` to `button`.
3. `StyleSheet` numbers become `px`. Percent paddings stay percentages (`mainContainer` is `6%`).
4. No new hex values in `screen.css` or `screen.js`. Add a token only when it already exists in the app styles.
5. Type is Inter (the website font). SF Pro stays in the app.
6. Data is a fixture. No wallet, network, or native modules.
7. Interaction is limited to press feedback, the home stagger (60ms delay, 150ms, 24px slide), and the Signer / Explorer / Converter tab switch.
8. The phone is a fixed 390 by 844 frame.

## Deployment

The site is deployed as plain static files on Netlify. There is no build step and no Node at runtime. Node is used only locally, to run `tools/`. That means:

- Commit everything in `generated/`. The deployed site reads those files directly.
- Pages load only `.html`, `.css` and `.js` files with `<script>`/`<link>`. No bundler, no `import` of npm packages, no server routes.
- Data the browser needs (routes, coverage) is emitted as `.js` files that set globals, so pages work from any static host or `file://`.

## Dashboard

`/studio/` opens on the Dashboard (`dashboard.js`, `dashboard.css`). It explains what Studio is and shows live progress:

- route coverage and coverage by area
- a filterable tracker of every missing route, with the components it uses and a link to its source
- the kit components ported so far
- icon, string and style-rule counts, and when extraction last ran

It reads `generated/meta.js`, `routes.js` and `coverage.js`, so rerun the two tools after porting screens. When you port an app component into the kit, add it to `KIT_PORTS` in `dashboard.js`.

## Extraction pipeline

Run `node studio/tools/extract-all.mjs --app ../satsigner/apps/mobile` (the default path assumes the app repo sits next to this one). It uses the app's own TypeScript install and writes these files to `generated/`. Never edit them by hand:

- `tokens.css` — every value in `styles/*.ts` (colours, sizes, layout, typography).
- `icons.js` — `ssIcons`, all `SSIcon*.tsx` files as SVG strings.
- `styles.css` — every `StyleSheet.create` as `.<File>__<key>` classes, with colours mapped to tokens. Use it as a reference when porting.
- `strings.js` — `en.json` plus `t('key')`. Use it instead of hard-coding copy.
- `routes.json` — every route with its params, navigation targets, SS components, and i18n keys.
- `extract-warnings.txt` — anything the scripts could not convert.

Then run `node studio/tools/coverage.mjs`. It maps catalog screens to app routes through `coverage.json` and writes `generated/coverage.md`, which shows routes with no screen and screens whose route was renamed in the app. Rerun both after pulling app changes.

## Component kit

`components.js` exposes `ss`, with one render function per app component (`ss.button`, `ss.text`, `ss.vstack`, `ss.textInput`, `ss.checkbox`, `ss.radio`, `ss.modal` and the rest). The props mirror the React Native props, and `go:` routes like `data-go`. The styles are in `components.css` (`ss-` classes, generated tokens only). Every kit component is shown at the top of the Components view (`?view=components`). Add a component there when you port it.

## Adding another screen

New screens go in `screens.js` with `registerScreen(id, { source, title, back, render, bind })`. They render into the shared `#view-kit` section, so you don't need to touch `index.html`. `go(id)` opens them, and `draft` and `sendOptions` hold state shared across a flow.

1. Pick a missing route from `generated/coverage.md`.
2. Read its `routes.json` entry for the components, strings, and targets it uses.
3. Build it with `ss.*`, port any missing component into the kit first, take copy from `t()`, and look up exact values in `generated/styles.css`.
4. Add the screen to `catalog.js` and its route to `coverage.json`.
